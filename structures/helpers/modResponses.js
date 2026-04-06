const styles = {
  success: {
    timeout: [
      ({ userTag, duration, reason }) =>
        `📦 O-okay. **${userTag}** is in the quiet box for \`${duration}\`.\n**Reason:** ${reason}`,
    ],

    untimeout: [
      ({ userTag }) =>
        `🔓 Aha... yes, right, there we are. **${userTag}** is out of the quiet box now.`,
    ],

    untimeoutAll: [
      ({ count }) =>
        `🔓 I opened **${count}** quiet box(es). It's a little louder in here now.`,
    ],

    ban: [
      ({ userTag, reason }) =>
        `🔨 Oh. Oh dear. **${userTag}** has been pushed out the front door.\n**Reason:** ${reason}`,
      ({ userTag, reason }) =>
        `🕯️ I-I did it. **${userTag}** is banned now.\n**Reason:** ${reason}`,
      ({ userTag, reason }) =>
        `♟️ The piece has been removed. **${userTag}** was banned.\n**Reason:** ${reason}`,
    ],

    tempban: [
      ({ userTag, duration, reason }) =>
        `⏳ Uhm... **${userTag}** has been sent away for \`${duration}\`.\n**Reason:** ${reason}`,
      ({ userTag, duration, reason }) =>
        `📦 **${userTag}** has been placed outside for \`${duration}\`.\n**Reason:** ${reason}`,
      ({ userTag, duration, reason }) =>
        `🎭 Temporary exile for **${userTag}** — \`${duration}\`.\n**Reason:** ${reason}`,
    ],

    unban: [
      ({ userTag }) =>
        `🔓 The door's unlocked again. **${userTag}** may return now.`,
    ],
  },

  error: {
    notInGuild: [
      `Oh no, no, no... this only works in a server.`,
    ],

    userNotFound: [
      `I can't seem to find that person. They may be under the table.`,
      `That user isn't turning up anywhere I can see.`,
    ],

    invalidDuration: [
      `That time is all crooked. Try \`10m\`, \`5h\`, \`2d\`, or \`1w\`.`,
    ],

    memberNotFound: [
      `That user doesn't seem to be in this server. Which is... troubling.`,
    ],

    notModeratable: [
      `I can't do that to this member. Something tall and official is in the way.`,
    ],

    hierarchy: [
      `That target is too high up on the board for you to move.`,
    ],

    nothingTimedOut: [
      `Nobody is in timeout right now. It's strangely peaceful.`,
    ],

    missingUserOrAll: [
      `You need to give me a user... or say \`all\`, if you really mean all.`,
    ],

    alreadyBanned: [
      `They're already gone. Banned already.`,
      `That user is already outside the walls.`,
    ],

    cannotBan: [
      `I can't ban that member. The pieces won't let me.`,
      `Something is blocking the ban. Authority, probably.`,
    ],
  },
};

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function modResponse(type, key, data = {}) {
  const group = styles[type]?.[key];
  if (!group || !group.length) return "Something strange happened in the walls.";

  const item = pick(group);
  return typeof item === "function" ? item(data) : item;
}

module.exports = modResponse;