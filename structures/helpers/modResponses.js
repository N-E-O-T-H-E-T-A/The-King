const styles = require("./modResponsesRaw");

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function modResponse(type, key, data = {}) {
  const group = styles[type]?.[key];

  if (!group || !group.length) {
    return "Something strange happened in the walls.";
  }

  const item = pick(group);
  return typeof item === "function" ? item(data) : item;
}

module.exports = modResponse;