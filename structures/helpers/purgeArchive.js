const { AttachmentBuilder } = require("discord.js");
const { getGuildSettings } = require("./database/guildSettings");

function escapeLine(text) {
  if (!text) return "";
  return text.replace(/\r/g, "").replace(/\n/g, "\\n");
}

async function archivePurgedMessages(client, {
  guild,
  sourceChannel,
  moderatorUser,
  messages,
  reason = "No reason provided",
}) {
  const settings = getGuildSettings(guild.id);
  if (!settings?.purge_archive_channel_id) return null;

  const archiveChannel = await guild.channels.fetch(settings.purge_archive_channel_id).catch(() => null);
  if (!archiveChannel?.isTextBased()) return null;

  const sorted = [...messages].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  const lines = [
    `Purge Archive`,
    `Guild: ${guild.name} (${guild.id})`,
    `Source Channel: #${sourceChannel.name} (${sourceChannel.id})`,
    `Moderator: ${moderatorUser.tag} (${moderatorUser.id})`,
    `Reason: ${reason}`,
    `Message Count: ${sorted.length}`,
    `Archived At: ${new Date().toISOString()}`,
    ``,
    `------------------------------------------------------------`,
    ``,
  ];

  for (const msg of sorted) {
    const stamp = new Date(msg.createdTimestamp).toISOString();
    const author = `${msg.author?.tag || "Unknown User"} (${msg.author?.id || "unknown"})`;
    const content = escapeLine(msg.content || "[no text content]");
    const attachments = msg.attachments?.size
      ? ` Attachments: ${[...msg.attachments.values()].map(a => a.url).join(", ")}`
      : "";

    lines.push(`[${stamp}] ${author}: ${content}${attachments}`);
  }

  const buffer = Buffer.from(lines.join("\n"), "utf8");
  const filename = `purge-${sourceChannel.id}-${Date.now()}.txt`;

  const attachment = new AttachmentBuilder(buffer, { name: filename });

  await archiveChannel.send({
    content: [
      `🧹 Purge archive from ${sourceChannel}`,
      `**Moderator:** ${moderatorUser}`,
      `**Reason:** ${reason}`,
      `**Messages:** ${sorted.length}`,
    ].join("\n"),
    files: [attachment],
    allowedMentions: { parse: [] },
  });

  return true;
}

module.exports = { archivePurgedMessages };