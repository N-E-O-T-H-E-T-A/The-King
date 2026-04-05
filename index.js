// index.js
require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  Events,
} = require("discord.js");

const CommandContext = require("./structures/CommandContext");

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = process.env.PREFIX || "!";

if (!TOKEN) {
  throw new Error("Missing DISCORD_TOKEN in .env");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User],
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
// test
function loadCommands() {
  const commandsPath = path.join(__dirname, "commands", "shared");
  const files = getAllJsFiles(commandsPath);

  for (const file of files) {
    delete require.cache[require.resolve(file)];
    const command = require(file);

    if (!command || !command.name || typeof command.run !== "function") {
      console.warn(`[COMMAND] Skipped invalid file: ${file}`);
      continue;
    }

    const commandName = command.name.toLowerCase();

    client.commands.set(commandName, command);

    if (Array.isArray(command.aliases)) {
      for (const alias of command.aliases) {
        client.aliases.set(alias.toLowerCase(), commandName);
      }
    }

    console.log(`[COMMAND] Loaded ${commandName}`);
  }
}

function loadEvents() {
  const eventsPath = path.join(__dirname, "events");
  const files = getAllJsFiles(eventsPath);

  for (const file of files) {
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
  }
}

function loadFeatures() {
  const featuresPath = path.join(__dirname, "features");
  const files = getAllJsFiles(featuresPath);

  for (const file of files) {
    delete require.cache[require.resolve(file)];
    const feature = require(file);

    if (typeof feature !== "function") {
      console.warn(`[FEATURE] Skipped invalid file: ${file}`);
      continue;
    }

    feature(client);
    console.log(`[FEATURE] Loaded ${path.basename(file)}`);
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
    await command.run(ctx);
  } catch (error) {
    console.error(`[COMMAND ERROR] ${command.name}`, error);

    try {
      if (type === "slash") {
        if (source.replied || source.deferred) {
          await source.followUp({
            content: "There was an error while running that command.",
            ephemeral: true,
          });
        } else {
          await source.reply({
            content: "There was an error while running that command.",
            ephemeral: true,
          });
        }
      } else {
        await source.reply("There was an error while running that command.");
      }
    } catch (replyError) {
      console.error("[COMMAND ERROR RESPONSE FAILED]", replyError);
    }
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command || !command.slash) return;

  await runSharedCommand(interaction, "slash", command);
});

client.on(Events.MessageCreate, async (message) => {
  if (!message.guild) return;
  if (message.author.bot) return;
  if (!message.content) return;
  if (!message.content.startsWith(client.config.prefix)) return;

  const raw = message.content.slice(client.config.prefix.length).trim();
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
});

loadCommands();
loadEvents();
loadFeatures();

client.login(TOKEN);