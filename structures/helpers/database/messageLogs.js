console.log("PATH TEST:", __dirname);
const db = require("../../../database/db");

const insertMessageLogStmt = db.prepare(`
  INSERT OR REPLACE INTO message_logs (
    message_id,
    guild_id,
    channel_id,
    author_id,
    author_tag,
    content,
    attachment_urls,
    created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const getMessageLogStmt = db.prepare(`
  SELECT *
  FROM message_logs
  WHERE message_id = ?
`);

const insertDeletedMessageStmt = db.prepare(`
  INSERT OR REPLACE INTO deleted_messages (
    message_id,
    guild_id,
    channel_id,
    author_id,
    author_tag,
    content,
    attachment_urls,
    created_at,
    deleted_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertEditedMessageStmt = db.prepare(`
  INSERT INTO edited_messages (
    message_id,
    guild_id,
    channel_id,
    author_id,
    author_tag,
    old_content,
    new_content,
    old_attachment_urls,
    new_attachment_urls,
    created_at,
    edited_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const deleteMessageLogStmt = db.prepare(`
  DELETE FROM message_logs
  WHERE message_id = ?
`);

const getLatestDeletedInChannelStmt = db.prepare(`
  SELECT *
  FROM deleted_messages
  WHERE guild_id = ? AND channel_id = ?
  ORDER BY deleted_at DESC
  LIMIT 1
`);

const getLatestDeletedInChannelForUserStmt = db.prepare(`
  SELECT *
  FROM deleted_messages
  WHERE guild_id = ? AND channel_id = ? AND author_id = ?
  ORDER BY deleted_at DESC
  LIMIT 1
`);

const getLatestEditedInChannelStmt = db.prepare(`
  SELECT *
  FROM edited_messages
  WHERE guild_id = ? AND channel_id = ?
  ORDER BY edited_at DESC
  LIMIT 1
`);

const getLatestEditedInChannelForUserStmt = db.prepare(`
  SELECT *
  FROM edited_messages
  WHERE guild_id = ? AND channel_id = ? AND author_id = ?
  ORDER BY edited_at DESC
  LIMIT 1
`);

const cleanupMessageLogsStmt = db.prepare(`
  DELETE FROM message_logs
  WHERE created_at < ?
`);

const cleanupDeletedMessagesStmt = db.prepare(`
  DELETE FROM deleted_messages
  WHERE deleted_at < ?
`);

const cleanupEditedMessagesStmt = db.prepare(`
  DELETE FROM edited_messages
  WHERE edited_at < ?
`);

function normalizeAttachments(attachments) {
  if (!attachments) return "[]";
  return JSON.stringify(attachments);
}

function parseAttachments(value) {
  try {
    return JSON.parse(value || "[]");
  } catch {
    return [];
  }
}

function upsertMessageLog({
  messageId,
  guildId,
  channelId,
  authorId,
  authorTag,
  content,
  attachmentUrls = [],
  createdAt,
}) {
  insertMessageLogStmt.run(
    messageId,
    guildId,
    channelId,
    authorId,
    authorTag,
    content || "",
    normalizeAttachments(attachmentUrls),
    createdAt
  );
}

function getMessageLog(messageId) {
  const row = getMessageLogStmt.get(messageId);
  if (!row) return null;

  return {
    ...row,
    attachment_urls: parseAttachments(row.attachment_urls),
  };
}

function saveDeletedMessage({
  messageId,
  guildId,
  channelId,
  authorId,
  authorTag,
  content,
  attachmentUrls = [],
  createdAt = null,
  deletedAt,
}) {
  insertDeletedMessageStmt.run(
    messageId,
    guildId,
    channelId,
    authorId,
    authorTag,
    content || "",
    normalizeAttachments(attachmentUrls),
    createdAt,
    deletedAt
  );
}

function saveEditedMessage({
  messageId,
  guildId,
  channelId,
  authorId,
  authorTag,
  oldContent,
  newContent,
  oldAttachmentUrls = [],
  newAttachmentUrls = [],
  createdAt = null,
  editedAt,
}) {
  insertEditedMessageStmt.run(
    messageId,
    guildId,
    channelId,
    authorId,
    authorTag,
    oldContent || "",
    newContent || "",
    normalizeAttachments(oldAttachmentUrls),
    normalizeAttachments(newAttachmentUrls),
    createdAt,
    editedAt
  );
}

function removeMessageLog(messageId) {
  deleteMessageLogStmt.run(messageId);
}

function getLatestDeletedInChannel(guildId, channelId, userId = null) {
  const row = userId
    ? getLatestDeletedInChannelForUserStmt.get(guildId, channelId, userId)
    : getLatestDeletedInChannelStmt.get(guildId, channelId);

  if (!row) return null;

  return {
    ...row,
    attachment_urls: parseAttachments(row.attachment_urls),
  };
}

function getLatestEditedInChannel(guildId, channelId, userId = null) {
  const row = userId
    ? getLatestEditedInChannelForUserStmt.get(guildId, channelId, userId)
    : getLatestEditedInChannelStmt.get(guildId, channelId);

  if (!row) return null;

  return {
    ...row,
    old_attachment_urls: parseAttachments(row.old_attachment_urls),
    new_attachment_urls: parseAttachments(row.new_attachment_urls),
  };
}

function cleanupMessageData(olderThanUnix) {
  cleanupMessageLogsStmt.run(olderThanUnix);
  cleanupDeletedMessagesStmt.run(olderThanUnix);
  cleanupEditedMessagesStmt.run(olderThanUnix);
}

module.exports = {
  upsertMessageLog,
  getMessageLog,
  saveDeletedMessage,
  saveEditedMessage,
  removeMessageLog,
  getLatestDeletedInChannel,
  getLatestEditedInChannel,
  cleanupMessageData,
};