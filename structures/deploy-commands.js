require("dotenv").config();


const fs = require("node:fs");
const path = require("node:path");
const { REST, Routes, SlashCommandBuilder } = require("discord.js");
const initDatabase = require("../database/init");
initDatabase();

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN) throw new Error("Missing DISCORD_TOKEN in .env");
if (!CLIENT_ID) throw new Error("Missing CLIENT_ID in .env");

function getAllJsFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    console.log("[DEBUG] Missing directory:", dir);
    return fileList;
  }

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

function addOption(builder, option) {
  const { name, description, type, required = false } = option;

  switch (type) {
    case "string":
      builder.addStringOption(opt =>
        opt.setName(name).setDescription(description).setRequired(required)
      );
      break;
    case "boolean":
      builder.addBooleanOption(opt =>
        opt.setName(name).setDescription(description).setRequired(required)
      );
      break;
    case "integer":
      builder.addIntegerOption(opt =>
        opt.setName(name).setDescription(description).setRequired(required)
      );
      break;
    case "number":
      builder.addNumberOption(opt =>
        opt.setName(name).setDescription(description).setRequired(required)
      );
      break;
    case "user":
      builder.addUserOption(opt =>
        opt.setName(name).setDescription(description).setRequired(required)
      );
      break;
    case "channel":
      builder.addChannelOption(opt =>
        opt.setName(name).setDescription(description).setRequired(required)
      );
      break;
    case "role":
      builder.addRoleOption(opt =>
        opt.setName(name).setDescription(description).setRequired(required)
      );
      break;
    case "mentionable":
      builder.addMentionableOption(opt =>
        opt.setName(name).setDescription(description).setRequired(required)
      );
      break;
    case "attachment":
      builder.addAttachmentOption(opt =>
        opt.setName(name).setDescription(description).setRequired(required)
      );
      break;
    default:
      throw new Error(`Unsupported option type: ${type}`);
  }
}

function buildSlashCommand(command) {
  const builder = new SlashCommandBuilder()
    .setName(command.name)
    .setDescription(command.description || "No description provided");

  if (command.defaultMemberPermissions) {
    builder.setDefaultMemberPermissions(command.defaultMemberPermissions);
  }

  if (Array.isArray(command.options)) {
    for (const option of command.options) {
      addOption(builder, option);
    }
  }

  return builder.toJSON();
}

function loadCommands() {
  const commandsPath = path.join(__dirname, "commands", "shared");
  const files = getAllJsFiles(commandsPath);

  console.log("[DEBUG] commandsPath:", commandsPath);
  console.log("[DEBUG] files found:", files);

  const commands = [];

  for (const file of files) {
    try {
      delete require.cache[require.resolve(file)];
      const command = require(file);

      console.log(`[DEBUG] Loaded file: ${file}`);
      console.log("[DEBUG] Exported object:", command);

      if (!command?.name || typeof command.run !== "function") {
        console.warn(`[DEPLOY] Skipping invalid command file: ${file}`);
        continue;
      }

      if (!command.slash) {
        console.warn(`[DEPLOY] Skipping ${command.name} because slash is not true`);
        continue;
      }

      const slashData = buildSlashCommand(command);
      commands.push(slashData);

      console.log(`[DEPLOY] Loaded /${command.name}`);
    } catch (error) {
      console.error(`[DEPLOY] Failed loading file ${file}`);
      console.error(error);
    }
  }

  return commands;
}

async function deploy() {
  const commands = loadCommands();
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  console.log(`[DEPLOY] Preparing to register ${commands.length} slash command(s)...`);

  try {
    if (GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
      );
      console.log(`[DEPLOY] Successfully registered ${commands.length} guild command(s).`);
    } else {
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
      );
      console.log(`[DEPLOY] Successfully registered ${commands.length} global command(s).`);
    }
  } catch (error) {
    console.error("[DEPLOY] Failed to register commands:", error);
  }
}

deploy();