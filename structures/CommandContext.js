// structures/CommandContext.js
class CommandContext {
  constructor({ client, source, type, args = [], command = null }) {
    this.client = client;
    this.source = source;
    this.type = type;
    this.args = args;
    this.command = command;

    this.isSlash = type === "slash";
    this.isPrefix = type === "prefix";

    this.user = this.isSlash ? source.user : source.author;
    this.member = source.member ?? null;
    this.guild = source.guild ?? null;
    this.channel = source.channel ?? null;
  }

  async reply(payload) {
    if (this.isSlash) {
      if (this.source.replied || this.source.deferred) {
        return this.source.followUp(payload);
      }
      return this.source.reply(payload);
    }

    return this.source.reply(payload);
  }

  async defer(options = {}) {
    if (!this.isSlash) return null;
    if (this.source.deferred || this.source.replied) return null;
    return this.source.deferReply(options);
  }

  async editReply(payload) {
    if (!this.isSlash) {
      throw new Error("editReply is only available for slash commands.");
    }
    return this.source.editReply(payload);
  }

  getSubcommand(fallback = null) {
    if (!this.isSlash) return fallback;
    try {
      return this.source.options.getSubcommand();
    } catch {
      return fallback;
    }
  }

  getString(name, fallback = null) {
    if (this.isSlash) {
      return this.source.options.getString(name) ?? fallback;
    }

    const index = this.#findPrefixOptionIndex(name);
    return index === -1 ? fallback : (this.args[index] ?? fallback);
  }

  getBoolean(name, fallback = null) {
    if (this.isSlash) {
      return this.source.options.getBoolean(name) ?? fallback;
    }

    const index = this.#findPrefixOptionIndex(name);
    const raw = index === -1 ? null : this.args[index];

    if (!raw) return fallback;

    const normalized = raw.toLowerCase();
    if (["true", "yes", "y", "1", "on"].includes(normalized)) return true;
    if (["false", "no", "n", "0", "off"].includes(normalized)) return false;

    return fallback;
  }

  getInteger(name, fallback = null) {
    if (this.isSlash) {
      return this.source.options.getInteger(name) ?? fallback;
    }

    const index = this.#findPrefixOptionIndex(name);
    const raw = index === -1 ? null : this.args[index];
    if (raw == null) return fallback;

    const value = Number.parseInt(raw, 10);
    return Number.isNaN(value) ? fallback : value;
  }

  getUser(name, fallback = null) {
    if (this.isSlash) {
      return this.source.options.getUser(name) ?? fallback;
    }

    return fallback;
  }

  getMember(name, fallback = null) {
    if (this.isSlash) {
      return this.source.options.getMember(name) ?? fallback;
    }

    return fallback;
  }

  #findPrefixOptionIndex(name) {
    if (!this.command || !Array.isArray(this.command.options)) return -1;
    return this.command.options.findIndex((opt) => opt.name === name);
  }
}

module.exports = CommandContext;