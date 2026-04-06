const modResponse = require("../../../helpers/modResponses");
const modResponseMap = require("../../../helpers/modResponsesRaw");

const OWNER_ID = "748607090875957248";

let index = 0;

function getAllResponses() {
  const responses = [];

  for (const type of Object.keys(modResponseMap)) {
    for (const key of Object.keys(modResponseMap[type])) {
      responses.push({ type, key });
    }
  }

  return responses;
}

function getFilteredResponses(typeFilter = null, keyFilter = null) {
  const responses = [];

  for (const type of Object.keys(modResponseMap)) {
    if (typeFilter && type !== typeFilter) continue;

    for (const key of Object.keys(modResponseMap[type])) {
      if (keyFilter && key !== keyFilter) continue;
      responses.push({ type, key });
    }
  }

  return responses;
}

module.exports = {
  name: "modtest",
  description: "Cycle through moderation response messages",
  aliases: ["mt"],
  slash: true,
  prefix: true,

  options: [
    {
      name: "type",
      type: "string",
      description: "Filter by response type",
      required: false,
      choices: [
        { name: "success", value: "success" },
        { name: "error", value: "error" },
      ],
    },
    {
      name: "key",
      type: "string",
      description: "Filter by response key like ban, timeout, hierarchy",
      required: false,
    },
    {
      name: "reset",
      type: "boolean",
      description: "Reset the cycle",
      required: false,
    },
  ],

  async run(ctx) {
    if (ctx.user.id !== OWNER_ID) return;

    let typeFilter = null;
    let keyFilter = null;
    let wantsReset = false;

    if (ctx.isSlash) {
      typeFilter = ctx.getString("type", null);
      keyFilter = ctx.getString("key", null);
      wantsReset = ctx.getBoolean("reset", false);
    } else {
      const first = ctx.args[0]?.toLowerCase() || null;
      const second = ctx.args[1]?.toLowerCase() || null;

      if (first === "reset") {
        wantsReset = true;
      } else if (first && ["success", "error"].includes(first)) {
        typeFilter = first;
        keyFilter = second;
      } else if (first) {
        keyFilter = first;
      }
    }

    if (wantsReset) {
      index = 0;
      return ctx.reply("Reset response cycle.");
    }

    let pool;

    if (typeFilter || keyFilter) {
      pool = getFilteredResponses(typeFilter, keyFilter);
    } else {
      pool = getAllResponses();
    }

    if (!pool.length) {
      return ctx.reply("No matching response group found.");
    }

    if (index >= pool.length) {
      index = 0;
    }

    const current = pool[index];

    const data = {
      userTag: "TestUser#0000",
      duration: "5h",
      reason: "testing purposes",
      count: 3,
    };

    const output = modResponse(current.type, current.key, data);

    index++;

    return ctx.reply(
      `**[${current.type}.${current.key}]** (${index}/${pool.length})\n${output}`
    );
  },
};