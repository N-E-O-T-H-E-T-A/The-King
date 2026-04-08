require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const { spawn } = require("node:child_process");
const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  Events,
} = require("discord.js");

const { startDashboard } = require("./dashboard/server");
const CommandContext = require("./structures/CommandContext");
const initDatabase = require("./database/init");
const { restoreTempBans } = require("./structures/helpers/tempBanScheduler");
const { buildHelpMap } = require("./structures/helpers/buildHelpData");
const { canUseCommandByConfiguredRoles } = require("./structures/helpers/commandRoleAccess");
const {
  ensureAnalyticsTables,
  recordCommandUse,
  recordModerationAction,
} = require("./structures/helpers/database/analytics");
const { getGuildSettings } = require("./structures/helpers/database/guildSettings");

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = process.env.PREFIX || "tk";

if (!TOKEN) {
  throw new Error("Missing DISCORD_TOKEN in .env");
}

console.log("ENV CHECK", {
  CLIENT_ID: !!process.env.CLIENT_ID,
  CLIENT_SECRET: !!process.env.CLIENT_SECRET,
  SESSION_SECRET: !!process.env.SESSION_SECRET,
  DASHBOARD_REDIRECT_URI: process.env.DASHBOARD_REDIRECT_URI,
  PORT: process.env.PORT,
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User, Partials.Reaction],
});

client.commands = new Collection();
client.aliases = new Collection();
client.cooldowns = new Collection();

client.config = {
  prefix: PREFIX,
};

function getAllJsFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      getAllJsFiles(fullPath, fileList);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      fileList.push(fullPath);
    }
  }

  return fileList;
}

function downloadCloudflared(dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    function request(url, redirectCount = 0) {
      if (redirectCount > 5) {
        reject(new Error("Too many redirects"));
        return;
      }

      https.get(url, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          const nextUrl = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, url).toString();

          request(nextUrl, redirectCount + 1);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: ${res.statusCode}`));
          return;
        }

        res.pipe(file);

        file.on("finish", () => {
          file.close(() => {
            fs.chmodSync(dest, 0o755);
            resolve();
          });
        });
      }).on("error", reject);
    }

    request("https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64");
  });
}

async function startCloudflareTunnel() {
  console.log("[TUNNEL] startCloudflareTunnel() called");

  const tunnelToken = process.env.TUNNEL_TOKEN;
  if (!tunnelToken) {
    console.warn("[TUNNEL] No TUNNEL_TOKEN found");
    return;
  }

  const cloudflaredPath = path.join(__dirname, "cloudflared");

  if (!fs.existsSync(cloudflaredPath)) {
    console.log("[TUNNEL] cloudflared not found, downloading...");
    try {
      await downloadCloudflared(cloudflaredPath);
      console.log("[TUNNEL] Download complete");
    } catch (err) {
      console.error("[TUNNEL] Download failed:", err);
      return;
    }
  }

  try {
    fs.chmodSync(cloudflaredPath, 0o755);
    console.log("[TUNNEL] Ensured executable permissions on cloudflared");
  } catch (err) {
    console.error("[TUNNEL] Failed to chmod cloudflared:", err);
    return;
  }

  const args = [
    "tunnel",
    "--loglevel",
    "debug",
    "--no-autoupdate",
    "run",
    "--token",
    tunnelToken,
  ];

  console.log("[TUNNEL] Starting Cloudflare Tunnel with args:", args.slice(0, 5).join(" "), "[token hidden]");

  const proc = spawn(cloudflaredPath, args, {
    cwd: __dirname,
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stdout.on("data", (data) => {
    process.stdout.write(`[TUNNEL] ${data}`);
  });

  proc.stderr.on("data", (data) => {
    process.stderr.write(`[TUNNEL ERROR] ${data}`);
  });

  proc.on("spawn", () => {
    console.log("[TUNNEL] cloudflared process spawned");
  });

  proc.on("error", (err) => {
    console.error("[TUNNEL ERROR] Failed to start:", err);
  });

  proc.on("exit", (code, signal) => {
    console.warn(`[TUNNEL] Exited code=${code} signal=${signal}`);
  });
}

function loadCommands() {
  const commandsPath = path.join(__dirname, "structures", "commands", "shared");
  const files = getAllJsFiles(commandsPath);

  console.log("[DEBUG] commandsPath:", commandsPath);
  console.log("[DEBUG] files found:", files);

  for (const file of files) {
    try {
      delete require.cache[require.resolve(file)];
      const command = require(file);

      if (!command || !command.name || typeof command.run !== "function") {
        console.warn(`[COMMAND] Skipped invalid file: ${file}`);
        continue;
      }

      const commandName = command.name.toLowerCase();
      const relativePath = path.relative(commandsPath, file);
      const parts = relativePath.split(path.sep);

      command.category = parts.length > 1 ? parts[0].toLowerCase() : "misc";
      command.filePath = file;

      client.commands.set(commandName, command);

      if (Array.isArray(command.aliases)) {
        for (const alias of command.aliases) {
          client.aliases.set(alias.toLowerCase(), commandName);
        }
      }

      console.log(`[COMMAND] Loaded ${commandName} (${command.category})`);
    } catch (error) {
      console.error(`[COMMAND] Failed loading ${file}`);
      console.error(error);
    }
  }
}

function loadEvents() {
  const eventsPath = path.join(__dirname, "events");
  const files = getAllJsFiles(eventsPath);

  for (const file of files) {
    try {
      delete require.cache[require.resolve(file)];
      const event = require(file);

      if (!event || !event.name || typeof event.execute !== "function") {
        console.warn(`[EVENT] Skipped invalid file: ${file}`);
        continue;
      }

      if (event.once) {
        client.once(event.name, (...args) => event.execute(client, ...args));
      } else {
        client.on(event.name, (...args) => event.execute(client, ...args));
      }

      console.log(`[EVENT] Loaded ${event.name}`);
    } catch (error) {
      console.error(`[EVENT] Failed loading ${file}`, error);
    }
  }
}

function loadFeatures() {
  const featuresPath = path.join(__dirname, "features");
  const files = getAllJsFiles(featuresPath);

  for (const file of files) {
    try {
      delete require.cache[require.resolve(file)];
      const feature = require(file);

      if (typeof feature !== "function") {
        console.warn(`[FEATURE] Skipped invalid file: ${file}`);
        continue;
      }

      feature(client);
      console.log(`[FEATURE] Loaded ${path.basename(file)}`);
    } catch (error) {
      console.error(`[FEATURE] Failed loading ${file}`, error);
    }
  }
}

async function runSharedCommand(source, type, command, args = []) {
  const ctx = new CommandContext({
    client,
    source,
    type,
    args,
    command,
  });

  try {
    if (ctx.guild && ctx.member && !command.adminOnly) {
      const access = canUseCommandByConfiguredRoles(
        ctx.member,
        ctx.guild,
        command.name
      );

      if (!access.allowed) {
        if (type === "slash") {
          if (source.replied || source.deferred) {
            await source.followUp({
              content: "You don't have an allowed role for that command.",
              ephemeral: true,
              allowedMentions: { parse: [] },
            }).catch(() => {});
          } else {
            await source.reply({
              content: "You don't have an allowed role for that command.",
              ephemeral: true,
              allowedMentions: { parse: [] },
            }).catch(() => {});
          }
        } else {
          await source.reply("You don't have an allowed role for that command.").catch(() => {});
        }

        return;
      }
    }

    await command.run(ctx);

    const guildId = source.guild?.id || source.guildId || null;
    const actorId = source.user?.id || source.author?.id || null;

    if (guildId) {
      recordCommandUse({
        guildId,
        commandName: command.name,
      });

      const modCommands = new Set([
        "ban",
        "mban",
        "timeout",
        "untimeout",
        "purge",
        "jail",
        "unjail",
        "unjailall",
        "reason",
        "case",
      ]);

      if (modCommands.has(command.name)) {
        recordModerationAction({
          guildId,
          actionType: command.name,
          moderatorId: actorId,
        });
      }
    }
  } catch (error) {
    console.error(`[COMMAND ERROR] ${command.name}`, error);

    try {
      if (type === "slash") {
        if (source.replied || source.deferred) {
          await source.followUp({
            content: "Something went a little sideways while running that command.",
            ephemeral: true,
          });
        } else {
          await source.reply({
            content: "Something went a little sideways while running that command.",
            ephemeral: true,
          });
        }
      } else {
        await source.reply("Something went a little sideways while running that command.");
      }
    } catch (replyError) {
      console.error("[COMMAND ERROR RESPONSE FAILED]", replyError);
    }
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ READY as ${readyClient.user.tag}`);
  console.log(`[DEBUG] Loaded command names: ${[...client.commands.keys()].join(", ")}`);

  try {
    await restoreTempBans(client);
  } catch (error) {
    console.error("[TEMPBAN RESTORE ERROR]", error);
  }

  startDashboard(client);
});

client.on("error", (err) => {
  console.error("[CLIENT ERROR]", err);
});

client.on("warn", (info) => {
  console.warn("[CLIENT WARN]", info);
});

process.on("unhandledRejection", (err) => {
  console.error("[UNHANDLED REJECTION]", err);
});

process.on("uncaughtException", (err) => {
  console.error("[UNCAUGHT EXCEPTION]", err);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command || !command.slash) return;

      await runSharedCommand(interaction, "slash", command);
      return;
    }

    if (
      interaction.isStringSelectMenu() ||
      interaction.isRoleSelectMenu() ||
      interaction.isButton()
    ) {
      if (interaction.customId.startsWith("cmdroles:")) {
        const commandRolesCommand = client.commands.get("commandroles");
        if (commandRolesCommand?.handleComponent) {
          await commandRolesCommand.handleComponent(interaction, client);
        }
        return;
      }
    }

    if (interaction.isStringSelectMenu()) {
      if (!interaction.customId.startsWith("help_select:")) return;

      const helpCommand = client.commands.get("help");
      if (!helpCommand?.renderHelp) return;

      const parts = interaction.customId.split(":");
      const selectedCategory = interaction.values[0] || parts[1] || null;

      await helpCommand.renderHelp(interaction, { client }, selectedCategory, 0);
      return;
    }

    if (interaction.isButton()) {
      if (!interaction.customId.startsWith("help_page:")) return;

      const helpCommand = client.commands.get("help");
      if (!helpCommand?.renderHelp) return;

      const [, action, category] = interaction.customId.split(":");

      const helpMap = buildHelpMap(client.commands, client.config.prefix);
      const commands = helpMap.get(category) || [];
      const totalPages = Math.max(1, Math.ceil(commands.length / 6));

      let currentPage = 0;
      const footerText = interaction.message.embeds?.[0]?.footer?.text || "";
      const match = footerText.match(/Page (\d+) \/ (\d+)/i);

      if (match) {
        currentPage = Math.max(0, Number(match[1]) - 1);
      }

      let nextPage = currentPage;

      if (action === "first") nextPage = 0;
      if (action === "prev") nextPage = Math.max(0, currentPage - 1);
      if (action === "next") nextPage = Math.min(totalPages - 1, currentPage + 1);
      if (action === "last") nextPage = totalPages - 1;

      await helpCommand.renderHelp(interaction, { client }, category, nextPage);
    }
  } catch (error) {
    console.error("[INTERACTION ERROR]", error);

    try {
      if (interaction.isRepliable()) {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: "Something strange happened while handling that interaction.",
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: "Something strange happened while handling that interaction.",
            ephemeral: true,
          });
        }
      }
    } catch (replyError) {
      console.error("[INTERACTION ERROR RESPONSE FAILED]", replyError);
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.content) return;
    const guildSettings = getGuildSettings(message.guild.id);
const activePrefix = guildSettings?.prefix || client.config.prefix;

if (!message.content.startsWith(activePrefix)) return;

const raw = message.content.slice(activePrefix.length).trim();
    if (!raw.length) return;

    const parts = raw.split(/\s+/);
    const trigger = parts.shift()?.toLowerCase();
    if (!trigger) return;

    const commandName = client.commands.has(trigger)
      ? trigger
      : client.aliases.get(trigger);

    if (!commandName) return;

    const command = client.commands.get(commandName);
    if (!command || !command.prefix) return;

    await runSharedCommand(message, "prefix", command, parts);
  } catch (error) {
    console.error("[MESSAGE COMMAND ERROR]", error);
  }
});

initDatabase();
ensureAnalyticsTables();
loadCommands();
loadEvents();
loadFeatures();

startCloudflareTunnel();

client.login(TOKEN);