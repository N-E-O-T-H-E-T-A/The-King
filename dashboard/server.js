const express = require("express");
const session = require("express-session");
const path = require("node:path");
const crypto = require("node:crypto");

const {
  getGuildSettings,
  setModLogChannel,
  setPurgeArchiveChannel,
} = require("../structures/helpers/database/guildSettings");
const {
  getJailSettings,
  setJailRole,
  setJailChannel,
} = require("../structures/helpers/database/jail");
const {
  getAllowedRoleIds,
  setAllowedRoleIds,
  clearAllowedRoleIds,
} = require("../structures/helpers/database/commandRoles");

const DISCORD_API = "https://discord.com/api/v10";
const ADMINISTRATOR_BIT = BigInt(0x8);

function startDashboard(client) {
  const app = express();
  const port = Number(process.env.PORT || 3000);

  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const redirectUri = process.env.DASHBOARD_REDIRECT_URI || `http://localhost:${port}/auth/callback`;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!clientId || !clientSecret || !sessionSecret) {
    console.warn("[DASHBOARD] Missing CLIENT_ID, CLIENT_SECRET, or SESSION_SECRET.");
  }

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(
    session({
      name: "the_king_dashboard",
      secret: sessionSecret || "replace_me",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    })
  );

  app.use(express.static(path.join(__dirname, "public")));

  function formatCommandHelp(command, prefix) {
    const optionText =
      Array.isArray(command.options) && command.options.length
        ? command.options
            .map((opt) => {
              const required = opt.required ? "required" : "optional";
              return `${opt.name} (${opt.type}, ${required})`;
            })
            .join(", ")
        : "No options";

    return {
      name: command.name,
      description: command.description || "No description provided.",
      category: command.category || "misc",
      aliases: Array.isArray(command.aliases) ? command.aliases : [],
      prefixUsage: command.prefix ? `${prefix}${command.name}` : null,
      slashUsage: command.slash ? `/${command.name}` : null,
      options: optionText,
    };
  }

  function getDashboardCommands() {
    const prefix = client.config?.prefix || ",";

    return [...client.commands.values()]
      .filter((cmd) => !cmd.hidden)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((cmd) => formatCommandHelp(cmd, prefix));
  }

  function hasAdminPermission(partialGuild) {
    try {
      if (partialGuild.owner) return true;
      const perms = BigInt(partialGuild.permissions || "0");
      return (perms & ADMINISTRATOR_BIT) === ADMINISTRATOR_BIT;
    } catch {
      return false;
    }
  }

  async function exchangeCode(code) {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${text}`);
    }

    return response.json();
  }

  async function fetchDiscordUser(accessToken) {
    const response = await fetch(`${DISCORD_API}/users/@me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user: ${response.status}`);
    }

    return response.json();
  }

  async function fetchDiscordGuilds(accessToken) {
    const response = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch guilds: ${response.status}`);
    }

    return response.json();
  }

  async function getAuthorizedGuilds(req) {
    if (!req.session?.discordAccessToken) return [];

    const userGuilds = await fetchDiscordGuilds(req.session.discordAccessToken);

    const visibleGuilds = userGuilds
      .filter((guild) => hasAdminPermission(guild))
      .filter((guild) => client.guilds.cache.has(guild.id))
      .map((guild) => {
        const botGuild = client.guilds.cache.get(guild.id);

        return {
          id: guild.id,
          name: guild.name,
          icon: guild.icon
            ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`
            : botGuild?.iconURL({ size: 128 }) || null,
          memberCount: botGuild?.memberCount ?? null,
          owner: Boolean(guild.owner),
          permissions: guild.permissions,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return visibleGuilds;
  }

  function requireAuth(req, res, next) {
    if (!req.session?.discordUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    next();
  }

  async function requireGuildAccess(req, res, next) {
    try {
      const guildId = req.params.id;
      const guilds = await getAuthorizedGuilds(req);
      const allowed = guilds.some((g) => g.id === guildId);

      if (!allowed) {
        return res.status(403).json({ error: "Forbidden" });
      }

      req.authorizedGuilds = guilds;
      next();
    } catch (error) {
      console.error("[DASHBOARD AUTH GUILD ERROR]", error);
      return res.status(500).json({ error: "Failed to verify guild access" });
    }
  }

  app.get("/auth/login", (req, res) => {
    const state = crypto.randomBytes(24).toString("hex");
    req.session.oauthState = state;

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      scope: "identify guilds",
      redirect_uri: redirectUri,
      state,
      prompt: "consent",
    });

    res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
  });

  app.get("/auth/callback", async (req, res) => {
    const { code, state } = req.query;

    if (!code || !state || state !== req.session.oauthState) {
      return res.status(400).send("Invalid OAuth state.");
    }

    try {
      const tokenData = await exchangeCode(code);
      const user = await fetchDiscordUser(tokenData.access_token);

      req.session.discordAccessToken = tokenData.access_token;
      req.session.discordRefreshToken = tokenData.refresh_token || null;
      req.session.discordUser = {
        id: user.id,
        username: user.username,
        global_name: user.global_name || null,
        avatar: user.avatar || null,
      };

      delete req.session.oauthState;

      res.redirect("/");
    } catch (error) {
      console.error("[DASHBOARD OAUTH CALLBACK ERROR]", error);
      res.status(500).send("Discord login failed.");
    }
  });

  app.post("/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  app.get("/api/me", (req, res) => {
    const user = req.session?.discordUser || null;
    res.json({
      authenticated: Boolean(user),
      user,
    });
  });

  app.get("/api/health", (req, res) => {
    res.json({
      ok: true,
      bot: client.user
        ? {
            tag: client.user.tag,
            id: client.user.id,
          }
        : null,
      guilds: client.guilds.cache.size,
      uptime: process.uptime(),
    });
  });

  app.get("/api/guilds", requireAuth, async (req, res) => {
    try {
      const guilds = await getAuthorizedGuilds(req);
      res.json(guilds);
    } catch (error) {
      console.error("[DASHBOARD GUILDS ERROR]", error);
      res.status(500).json({ error: "Failed to load guilds" });
    }
  });

  app.get("/api/guild/:id/settings", requireAuth, requireGuildAccess, async (req, res) => {
    const guildId = req.params.id;
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({ error: "Guild not found" });
    }

    const guildSettings = getGuildSettings(guildId);
    const jailSettings = getJailSettings(guildId);

    const channels = guild.channels.cache
      .filter((channel) => channel.isTextBased())
      .map((channel) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const roles = guild.roles.cache
      .filter((role) => role.id !== guild.id)
      .map((role) => ({
        id: role.id,
        name: role.name,
        position: role.position,
      }))
      .sort((a, b) => b.position - a.position);

    res.json({
      guild: {
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ size: 128 }),
      },
      settings: guildSettings,
      jail: jailSettings,
      channels,
      roles,
      commands: getDashboardCommands(),
    });
  });

  app.post("/api/guild/:id/settings", requireAuth, requireGuildAccess, async (req, res) => {
    const guildId = req.params.id;
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({ error: "Guild not found" });
    }

    const {
      modLogChannelId,
      purgeArchiveChannelId,
      jailChannelId,
      jailRoleId,
    } = req.body;

    try {
      if (modLogChannelId !== undefined) {
        setModLogChannel(guildId, modLogChannelId || null);
      }

      if (purgeArchiveChannelId !== undefined) {
        setPurgeArchiveChannel(guildId, purgeArchiveChannelId || null);
      }

      if (jailRoleId !== undefined) {
        setJailRole(guildId, jailRoleId || null);
      }

      if (jailChannelId !== undefined) {
        setJailChannel(guildId, jailChannelId || null);
      }

      const updatedGuildSettings = getGuildSettings(guildId);
      const updatedJailSettings = getJailSettings(guildId);

      return res.json({
        ok: true,
        settings: updatedGuildSettings,
        jail: updatedJailSettings,
      });
    } catch (error) {
      console.error("[DASHBOARD SAVE SETTINGS ERROR]", error);
      return res.status(500).json({
        ok: false,
        error: "Failed to save settings",
      });
    }
  });

  app.get("/api/guild/:id/command-roles/:command", requireAuth, requireGuildAccess, (req, res) => {
    const guildId = req.params.id;
    const commandName = req.params.command;
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({ error: "Guild not found" });
    }

    const command = client.commands.get(commandName);
    if (!command) {
      return res.status(404).json({ error: "Command not found" });
    }

    const roleIds = getAllowedRoleIds(guildId, commandName);
    const roles = roleIds.map((id) => {
      const role = guild.roles.cache.get(id);
      return {
        id,
        name: role ? role.name : `Deleted Role (${id})`,
      };
    });

    return res.json({
      ok: true,
      command: formatCommandHelp(command, client.config?.prefix || ","),
      roleIds,
      roles,
    });
  });

  app.post("/api/guild/:id/command-roles/:command", requireAuth, requireGuildAccess, (req, res) => {
    const guildId = req.params.id;
    const commandName = req.params.command;
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({ error: "Guild not found" });
    }

    const command = client.commands.get(commandName);
    if (!command) {
      return res.status(404).json({ error: "Command not found" });
    }

    const roleIds = Array.isArray(req.body.roleIds) ? req.body.roleIds : [];

    try {
      const cleanedRoleIds = roleIds.filter((id) => guild.roles.cache.has(id));
      setAllowedRoleIds(guildId, commandName, cleanedRoleIds);

      return res.json({
        ok: true,
        command: command.name,
        roleIds: getAllowedRoleIds(guildId, commandName),
      });
    } catch (error) {
      console.error("[DASHBOARD SAVE COMMAND ROLES ERROR]", error);
      return res.status(500).json({
        ok: false,
        error: "Failed to save role permissions",
      });
    }
  });

  app.delete("/api/guild/:id/command-roles/:command", requireAuth, requireGuildAccess, (req, res) => {
    const guildId = req.params.id;
    const commandName = req.params.command;
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({ error: "Guild not found" });
    }

    const command = client.commands.get(commandName);
    if (!command) {
      return res.status(404).json({ error: "Command not found" });
    }

    try {
      clearAllowedRoleIds(guildId, commandName);

      return res.json({
        ok: true,
        command: command.name,
        roleIds: [],
      });
    } catch (error) {
      console.error("[DASHBOARD CLEAR COMMAND ROLES ERROR]", error);
      return res.status(500).json({
        ok: false,
        error: "Failed to clear role permissions",
      });
    }
  });

  app.use((req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });

  app.listen(port, "0.0.0.0", () => {
  console.log(`🌐 Dashboard running on port ${port}`);
});
}

module.exports = { startDashboard };