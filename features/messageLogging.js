const { Events } = require("discord.js");
const {
  upsertMessageLog,
  getMessageLog,
  saveDeletedMessage,
  saveEditedMessage,
  removeMessageLog,
  cleanupMessageData,
} = require("../structures/helpers/database/messageLogs");

const RETENTION_SECONDS = 24 * 60 * 60;
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

function getAttachmentUrls(message) {
  if (!message?.attachments?.size) return [];
  return [...message.attachments.values()].map((a) => a.url);
}

function nowUnix() {
  return Math.floor(Date.now() / 1000);
}

module.exports = function messageLoggingFeature(client) {
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (!message.guild) return;
      if (message.author?.bot) return;

      upsertMessageLog({
        messageId: message.id,
        guildId: message.guild.id,
        channelId: message.channel.id,
        authorId: message.author.id,
        authorTag: message.author.tag,
        content: message.content || "",
        attachmentUrls: getAttachmentUrls(message),
        createdAt: Math.floor(message.createdTimestamp / 1000),
      });
    } catch (error) {
      console.error("[MESSAGE LOGGING] MessageCreate failed", error);
    }
  });

  client.on(Events.MessageDelete, async (message) => {
    try {
      if (!message.guild) return;
      if (message.author?.bot) return;

      const existing = getMessageLog(message.id);

      saveDeletedMessage({
        messageId: message.id,
        guildId: message.guild.id,
        channelId: message.channel.id,
        authorId: existing?.author_id || message.author?.id || "unknown",
        authorTag: existing?.author_tag || message.author?.tag || "Unknown User",
        content: existing?.content || message.content || "",
        attachmentUrls: existing?.attachment_urls || getAttachmentUrls(message),
        createdAt: existing?.created_at || (message.createdTimestamp ? Math.floor(message.createdTimestamp / 1000) : null),
        deletedAt: nowUnix(),
      });

      removeMessageLog(message.id);
    } catch (error) {
      console.error("[MESSAGE LOGGING] MessageDelete failed", error);
    }
  });

  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    try {
      if (!newMessage.guild) return;
      if (newMessage.author?.bot) return;

      const existing = getMessageLog(newMessage.id);

      const oldContent = existing?.content ?? oldMessage.content ?? "";
      const newContent = newMessage.content ?? "";

      const oldAttachmentUrls = existing?.attachment_urls ?? getAttachmentUrls(oldMessage);
      const newAttachmentUrls = getAttachmentUrls(newMessage);

      const oldAttachmentJson = JSON.stringify(oldAttachmentUrls);
      const newAttachmentJson = JSON.stringify(newAttachmentUrls);

      if (oldContent === newContent && oldAttachmentJson === newAttachmentJson) {
        return;
      }

      saveEditedMessage({
        messageId: newMessage.id,
        guildId: newMessage.guild.id,
        channelId: newMessage.channel.id,
        authorId: existing?.author_id || newMessage.author?.id || oldMessage.author?.id || "unknown",
        authorTag: existing?.author_tag || newMessage.author?.tag || oldMessage.author?.tag || "Unknown User",
        oldContent,
        newContent,
        oldAttachmentUrls,
        newAttachmentUrls,
        createdAt: existing?.created_at || (newMessage.createdTimestamp ? Math.floor(newMessage.createdTimestamp / 1000) : null),
        editedAt: nowUnix(),
      });

      upsertMessageLog({
        messageId: newMessage.id,
        guildId: newMessage.guild.id,
        channelId: newMessage.channel.id,
        authorId: existing?.author_id || newMessage.author.id,
        authorTag: existing?.author_tag || newMessage.author.tag,
        content: newContent,
        attachmentUrls: newAttachmentUrls,
        createdAt: existing?.created_at || Math.floor(newMessage.createdTimestamp / 1000),
      });
    } catch (error) {
      console.error("[MESSAGE LOGGING] MessageUpdate failed", error);
    }
  });

  setInterval(() => {
    try {
      cleanupMessageData(nowUnix() - RETENTION_SECONDS);
    } catch (error) {
      console.error("[MESSAGE LOGGING] Cleanup failed", error);
    }
  }, CLEANUP_INTERVAL_MS);
};