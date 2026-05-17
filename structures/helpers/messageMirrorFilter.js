const { PermissionsBitField } = require("discord.js");
const { getBlockedWords } = require("./database/blockedWords");

const webhookCache = new Map();

function escapeRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildBlockedWordRegex(words) {
  const normalized = words
    .map((word) => String(word || "").trim().toLowerCase())
    .filter(Boolean);

  if (!normalized.length) {
    return null;
  }

  return new RegExp(`\\b(${normalized.map(escapeRegex).join("|")})\\b`, "i");
}

function getWebhookCacheKey(channel) {
  return `${channel.guild.id}:${channel.id}`;
}

async function getOrCreateChannelWebhook(channel) {
  const cacheKey = getWebhookCacheKey(channel);
  const cached = webhookCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const me =
    channel.guild.members.me ||
    (await channel.guild.members.fetchMe().catch(() => null));

  if (!me) {
    throw new Error("Failed to resolve bot member.");
  }

  const permissions = channel.permissionsFor(me);
  if (
    !permissions?.has(PermissionsBitField.Flags.ManageWebhooks) ||
    !permissions?.has(PermissionsBitField.Flags.SendMessages)
  ) {
    throw new Error("Missing ManageWebhooks or SendMessages permission.");
  }

  const existingHooks = await channel.fetchWebhooks().catch(() => null);
  const reusable =
    existingHooks?.find((hook) => hook.owner?.id === me.id) || null;

  const webhook =
    reusable ||
    (await channel.createWebhook({
      name: "TK Mirror Filter",
      reason: "Webhook used to mirror filtered messages.",
    }));

  webhookCache.set(cacheKey, webhook);
  return webhook;
}

async function resolveReplyMention(message) {
  if (!message.reference?.messageId) {
    return "";
  }

  const referenced = await message.channel.messages
    .fetch(message.reference.messageId)
    .catch(() => null);

  if (!referenced?.author) {
    return "";
  }

  return `<@${referenced.author.id}>`;
}

function getWebhookIdentity(member, author) {
  const displayName =
    member?.displayName ||
    member?.nickname ||
    author.globalName ||
    author.username;

  const avatarURL =
    member?.displayAvatarURL?.({ extension: "png", size: 256 }) ||
    author.displayAvatarURL?.({ extension: "png", size: 256 }) ||
    null;

  return {
    username: displayName,
    avatarURL,
  };
}

function shouldSkipMessage(message) {
  if (!message.guild) return true;
  if (!message.inGuild()) return true;
  if (message.author?.bot) return true;
  if (message.webhookId) return true;
  if (!message.content?.trim() && !message.attachments.size) return true;
  return false;
}

async function mirrorFilteredMessage(message) {
  const blockedWords = getBlockedWords(message.guild.id);
  const blockedWordRegex = buildBlockedWordRegex(blockedWords);

  if (!blockedWordRegex) {
    return false;
  }

  if (!blockedWordRegex.test(message.content || "")) {
    return false;
  }

  const me =
    message.guild.members.me ||
    (await message.guild.members.fetchMe().catch(() => null));

  if (!me) {
    return false;
  }

  const permissions = message.channel.permissionsFor(me);
  if (
    !permissions?.has(PermissionsBitField.Flags.ManageWebhooks) ||
    !permissions?.has(PermissionsBitField.Flags.ManageMessages) ||
    !permissions?.has(PermissionsBitField.Flags.SendMessages)
  ) {
    return false;
  }

  const replyMention = await resolveReplyMention(message);
  const webhook = await getOrCreateChannelWebhook(message.channel);
  const identity = getWebhookIdentity(message.member, message.author);

  const files = [...message.attachments.values()].map((attachment) => ({
    attachment: attachment.url,
    name: attachment.name || "file",
  }));

  const content = [replyMention, message.content?.trim() || ""]
    .filter(Boolean)
    .join("\n");

  await webhook.send({
    content: content || null,
    username: identity.username,
    avatarURL: identity.avatarURL,
    files,
    allowedMentions: {
      parse: ["users"],
      repliedUser: false,
    },
  });

  await message.delete().catch(() => null);
  return true;
}

function registerMessageMirrorFilter(client) {
  client.on("messageCreate", async (message) => {
    try {
      if (shouldSkipMessage(message)) {
        return;
      }

      await mirrorFilteredMessage(message);
    } catch (error) {
      console.error("[FILTER] Failed to mirror filtered message:", error);
    }
  });
}

module.exports = {
  registerMessageMirrorFilter,
  mirrorFilteredMessage,
};