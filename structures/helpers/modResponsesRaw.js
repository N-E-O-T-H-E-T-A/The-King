const styles = {
  success: {
    timeout: [
      ({ userTag, duration, reason }) =>
        `📦 Right. Yes. Good. Splendid. **${userTag}** is in the quiet box for \`${duration}\`. Don't tap on it.\n**Reason:** ${reason}`,
      ({ userTag, duration, reason }) =>
        `🕯️ I put **${userTag}** somewhere safer. Or worse. Hard to tell. They'll be timed out for \`${duration}\`.\n**Reason:** ${reason}`,
      ({ userTag, duration, reason }) =>
        `♟️ There. I moved the piece. **${userTag}** has been tucked away for \`${duration}\`, where the shouting can't crawl under the door.\n**Reason:** ${reason}`,
      ({ userTag, duration, reason }) =>
        `📫 Good news, bad news, dreadful news—**${userTag}** is timed out for \`${duration}\`. The room is quieter now and I don't trust it.\n**Reason:** ${reason}`,
    ],

    untimeout: [
      ({ userTag }) =>
        `🔓 Oh! There they are again. **${userTag}** has been let out of the quiet box. Everyone act natural.`,
      ({ userTag }) =>
        `🪟 I opened it. I shouldn't have, probably, but I did. **${userTag}** is no longer timed out.`,
      ({ userTag }) =>
        `🎩 The lock panicked and gave up. **${userTag}** may speak again. Let's all pretend this was part of the plan.`,
      ({ userTag }) =>
        `🕯️ Yes, yes, alright then—**${userTag}** is free from timeout. If the walls start whispering, that's unrelated.`,
    ],

    untimeoutAll: [
      ({ count }) =>
        `🔓 I opened **${count}** quiet box(es). This was a mistake. A reversible one, but a mistake.`,
      ({ count }) =>
        `📦 They're all out now—**${count}** of them. The hallway is noisy and judgemental.`,
      ({ count }) =>
        `🪑 I let **${count}** member(s) back in from timeout. The chairs know what happened.`,
      ({ count }) =>
        `🎭 Wonderful. Terrible. **${count}** timeouts have been undone and the atmosphere is worse.`,
    ],

    ban: [
      ({ userTag, reason }) =>
        `🔨 Oh, that's done now. **${userTag}** has been banned. The door objected, but doors are cowards.\n**Reason:** ${reason}`,
      ({ userTag, reason }) =>
        `🕳️ **${userTag}** fell out of the server. Entirely on purpose this time.\n**Reason:** ${reason}`,
      ({ userTag, reason }) =>
        `♟️ I removed **${userTag}** from the board before the board got ideas.\n**Reason:** ${reason}`,
      ({ userTag, reason }) =>
        `🕯️ Right, yes, no coming back through that door for **${userTag}**. Banned. Properly banned.\n**Reason:** ${reason}`,
    ],

    tempban: [
      ({ userTag, duration, reason }) =>
        `⏳ **${userTag}** has been exiled for \`${duration}\`. Not forever. Just long enough for the air to stop crackling.\n**Reason:** ${reason}`,
      ({ userTag, duration, reason }) =>
        `📦 Temporary banishment! **${userTag}** goes outside the walls for \`${duration}\`, where the floor can deal with them.\n**Reason:** ${reason}`,
      ({ userTag, duration, reason }) =>
        `🎭 I sent **${userTag}** away for \`${duration}\`. It's temporary, unless time misbehaves again.\n**Reason:** ${reason}`,
      ({ userTag, duration, reason }) =>
        `🪞 **${userTag}** has been banned for \`${duration}\`. They'll be allowed back in once the clocks stop biting.\n**Reason:** ${reason}`,
    ],

    unban: [
      ({ userTag }) =>
        `🔓 Fine. Fine! **${userTag}** may come back in, but I don't want any staircase incidents.`,
      ({ userTag }) =>
        `🕯️ The ban has been lifted for **${userTag}**. Keep your hands inside the narrative at all times.`,
      ({ userTag }) =>
        `🚪 I opened the door again. Against my better instincts, **${userTag}** may return.`,
      ({ userTag }) =>
        `♟️ **${userTag}** has been placed back on the board. Nobody breathe too hard.`,
    ],
  },

  error: {
    notInGuild: [
      `No, no, no—this won't work out here. This command needs a server. A room. Walls. Preferably honest walls.`,
      `You can't do that in the void. The void never files the paperwork correctly.`,
      `This command only works in a server. Out here, everything slips sideways.`,
      `No server, no command. That's the rule. I didn't make it. I just fear it.`,
    ],

    userNotFound: [
      `I can't find that user. They may be behind the moon. Or the couch.`,
      `That person isn't showing up anywhere sensible.`,
      `I looked everywhere obvious and two places that weren't. No sign of them.`,
      `That user appears to be missing, misplaced, or folded into a smaller shape.`,
    ],

    invalidDuration: [
      `That time is wrong. Bent. Crooked. Use \`10m\`, \`5h\`, \`2d\`, or \`1w\` before the clock notices.`,
      `I can't use that duration. The numbers are crawling. Try \`10m\`, \`5h\`, \`2d\`, or \`1w\`.`,
      `That time format is all teeth and elbows. Use something normal, like \`10m\` or \`7d\`.`,
      `The clocks rejected that. Rudely. Try \`10m\`, \`5h\`, \`2d\`, or \`1w\`.`,
    ],

    memberNotFound: [
      `That user isn't in this server. Which is suspicious, because I was prepared for them.`,
      `They're not here. Unless they're in the vents, and I'm not checking again.`,
      `That member doesn't seem to exist in this server's immediate reality.`,
      `No sign of them in the server. The corners are clear. For now.`,
    ],

    notModeratable: [
      `I can't moderate that member. Something tall, official, and deeply inconvenient is in the way.`,
      `No good—the hierarchy's jammed in the gears somewhere.`,
      `I can't reach that member with moderation tools. The board won't let me touch that piece.`,
      `That target is protected by paperwork, authority, or dark geometry.`,
    ],

    hierarchy: [
      `That target is too high up on the board for you to move. Terrible board. Very strict.`,
      `You can't moderate that one—wrong ladder, wrong rung, wrong century.`,
      `No, no, they've got equal or higher role power. The system gets fussy about that.`,
      `That piece outranks yours. I hate when the pieces do that.`,
    ],

    nothingTimedOut: [
      `Nobody is timed out right now. Which sounds nice, but I don't trust quiet rooms.`,
      `There isn't anyone in timeout at the moment. The boxes are empty and that's somehow worse.`,
      `No timed out members. Just open space and dreadful potential.`,
      `Nobody's in the quiet box. It's staring at me.`,
    ],

    missingUserOrAll: [
      `You need to give me a user, or say \`all\` if you mean everybody. Be specific. Specificity prevents collapse.`,
      `I need a target. A person. Or \`all\`. Preferably not both in a mysterious tone.`,
      `Please tell me who you mean—or use \`all\` if you've truly abandoned caution.`,
      `User or \`all\`, please. I can't moderate interpretive dance.`,
    ],

    alreadyBanned: [
      `They're already banned. I can't ban them harder without tools I am not allowed to own.`,
      `That user is already outside the walls.`,
      `Already banned. Entirely gone. Very efficient, actually.`,
      `No need—they've already been thrown off the board.`,
    ],

    cannotBan: [
      `I can't ban that member. Something structural is refusing to cooperate.`,
      `No good. The ban won't take. Too much authority in the way.`,
      `I can't do that ban. The system hissed at me.`,
      `That target can't be banned by me right now. The mechanisms are sulking.`,
    ],
  },
};

module.exports = styles;