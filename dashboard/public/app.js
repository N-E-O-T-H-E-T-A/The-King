const Dashboard = (() => {
  const state = {
    me: null,
    guilds: [],
    guildId: null,
    guild: null,
    rolePickerApi: null,
  };

  const $ = (id) => document.getElementById(id);

  const esc = (v) =>
    String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const api = async (url, options = {}) => {
    const res = await fetch(url, options);
    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("application/json") ? await res.json() : await res.text();

    if (!res.ok) {
      throw new Error(typeof data === "object" ? data.error || "Request failed" : data);
    }

    return data;
  };

  const fmtUptime = (s = 0) => {
    s = Math.floor(s);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${sec}s`].filter(Boolean).join(" ");
  };

  const fmtDur = (s = 0) => {
    s = Math.floor(s);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const route = () => {
    const p = location.pathname.split("/").filter(Boolean);
    if (p[0] === "guild" && p[1]) {
      return { type: "guild", id: p[1], page: p[2] || "overview" };
    }
    return { type: "home" };
  };

  const go = (path) => {
    history.pushState({}, "", path);
    render();
  };

  const goHome = () => go("/");
  const goGuildPage = (page, id = state.guildId) => {
    if (!id) return;
    go(`/guild/${id}/${page}`);
  };

  const setTop = (title, subtitle, crumb, save = false, back = false) => {
    $("pageTitle").textContent = title;
    $("pageSubtitle").textContent = subtitle;
    $("breadcrumb").textContent = crumb;
    $("saveButton").style.display = save ? "inline-flex" : "none";
    $("backButton").style.display = back ? "inline-flex" : "none";
  };

  const setSaveStatus = (text, type = "") => {
    const el = $("saveStatus");
    if (!el) return;
    el.textContent = text;
    el.className = `saveStatus ${type}`.trim();
  };

  const activeNav = (page = null) => {
    document.querySelectorAll(".navItem").forEach((n) => n.classList.remove("active"));

    if (!page && location.pathname === "/") {
      document.querySelector('.navItem[data-route="/"]')?.classList.add("active");
    }

    if (page) {
      document.querySelector(`.navItem[data-page="${page}"]`)?.classList.add("active");
    }

    $("guildNavGroup").style.display = state.guildId ? "flex" : "none";
  };

  const closeSelects = (except = null) => {
    document.querySelectorAll(".customSelect").forEach((el) => {
      if (el !== except) el.classList.remove("open");
    });
  };

  const makeOption = (value, label, selected = null) => {
    const o = document.createElement("option");
    o.value = value ?? "";
    o.textContent = label;
    if ((selected ?? "") === (value ?? "")) o.selected = true;
    return o;
  };

  function buildSelect(id, onChange = null) {
    const select = $(id);
    const mount = $(`${id}_custom`);
    if (!select || !mount) return;

    const opts = [...select.options];
    const cur = opts[select.selectedIndex] || opts[0];

    mount.innerHTML = `
      <div class="customSelect">
        <button type="button" class="customSelectTrigger">
          <span class="customSelectValue">${esc(cur ? cur.textContent : "None")}</span>
          <span class="customSelectArrow">▾</span>
        </button>
        <div class="customSelectMenu">
          <div class="customSelectSearchWrap">
            <input class="customSelectSearch" type="text" placeholder="Search..." />
          </div>
          <div class="customSelectOptions"></div>
        </div>
      </div>
    `;

    const wrap = mount.querySelector(".customSelect");
    const trigger = mount.querySelector(".customSelectTrigger");
    const value = mount.querySelector(".customSelectValue");
    const search = mount.querySelector(".customSelectSearch");
    const list = mount.querySelector(".customSelectOptions");

    const renderOpts = (q = "") => {
      q = q.trim().toLowerCase();

      list.innerHTML = opts
        .filter((o) => o.textContent.toLowerCase().includes(q))
        .map(
          (o) =>
            `<button type="button" class="customSelectOption ${o.value === select.value ? "active" : ""}" data-value="${esc(o.value)}">${esc(o.textContent)}</button>`
        )
        .join("");

      list.querySelectorAll(".customSelectOption").forEach((btn) => {
        btn.onclick = () => {
          select.value = btn.dataset.value;
          value.textContent = btn.textContent;
          wrap.classList.remove("open");
          if (onChange) onChange();
        };
      });
    };

    renderOpts();

    trigger.onclick = () => {
      const open = wrap.classList.contains("open");
      closeSelects(wrap);
      wrap.classList.toggle("open", !open);

      if (!open) {
        search.value = "";
        renderOpts("");
        setTimeout(() => search.focus(), 0);
      }
    };

    search.oninput = () => renderOpts(search.value);
  }

  function buildMultiRolePicker(containerId, roles, selectedIds = [], onChange = null) {
    const mount = $(containerId);
    if (!mount) return null;

    let chosen = new Set(selectedIds);

    const renderPicker = (filter = "") => {
      const q = filter.trim().toLowerCase();
      const visible = roles.filter((r) => r.name.toLowerCase().includes(q));

      mount.innerHTML = `
        <div class="rolePicker">
          <div class="rolePickerSearchWrap">
            <input id="rolePickerSearch" class="commandSearch" type="text" placeholder="Search roles..." value="${esc(filter)}" />
          </div>
          <div class="rolePickerSelected">
            ${
              [...chosen].length
                ? roles
                    .filter((r) => chosen.has(r.id))
                    .map(
                      (r) =>
                        `<button type="button" class="roleTag selected" data-role-remove="${esc(r.id)}">${esc(r.name)} ✕</button>`
                    )
                    .join("")
                : `<span class="emptyChip">No roles selected.</span>`
            }
          </div>
          <div class="rolePickerList">
            ${visible
              .map(
                (r) => `
                <button
                  type="button"
                  class="rolePickerItem ${chosen.has(r.id) ? "active" : ""}"
                  data-role-id="${esc(r.id)}"
                >
                  <span>${esc(r.name)}</span>
                  <span>${chosen.has(r.id) ? "Selected" : "Add"}</span>
                </button>
              `
              )
              .join("")}
          </div>
        </div>
      `;

      $("rolePickerSearch").oninput = (e) => renderPicker(e.target.value);

      mount.querySelectorAll("[data-role-id]").forEach((btn) => {
        btn.onclick = () => {
          const id = btn.dataset.roleId;
          if (chosen.has(id)) chosen.delete(id);
          else chosen.add(id);
          renderPicker(filter);
          if (onChange) onChange([...chosen]);
        };
      });

      mount.querySelectorAll("[data-role-remove]").forEach((btn) => {
        btn.onclick = () => {
          chosen.delete(btn.dataset.roleRemove);
          renderPicker(filter);
          if (onChange) onChange([...chosen]);
        };
      });
    };

    renderPicker("");

    return {
      getValues: () => [...chosen],
      setValues: (vals) => {
        chosen = new Set(vals || []);
        renderPicker("");
      },
    };
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".customSelect")) closeSelects();
  });

  const fillSelect = (id, rows, selected, labelKey = "name", none = true, onChange = null) => {
    const s = $(id);
    if (!s) return;

    s.innerHTML = "";
    if (none) s.appendChild(makeOption("", "None", selected));
    rows.forEach((r) => s.appendChild(makeOption(r.id, r[labelKey], selected)));
    buildSelect(id, onChange);
  };

  const setUserUI = (authed, user) => {
    $("authNotice").style.display = authed ? "none" : "block";
    $("loginButton").style.display = authed ? "none" : "inline-flex";
    $("userBadge").style.display = authed ? "flex" : "none";

    if (authed) {
      $("userName").textContent = user?.global_name || user?.username || "User";
      $("userAvatarInitial").textContent = (user?.global_name || user?.username || "U").charAt(0).toUpperCase();
    }
  };

  const loadMe = async () => {
    const me = await api("/api/me");
    state.me = me.user || null;
    setUserUI(me.authenticated, me.user);
    return me.authenticated;
  };

  const loadGuilds = async () => {
    try {
      state.guilds = await api("/api/guilds");
    } catch {
      state.guilds = [];
    }
    renderGuildSwitcher();
  };

  const renderGuildSwitcher = () => {
    const mount = $("guildSwitcherMount");
    if (!state.guilds.length) {
      mount.innerHTML = `<p class="emptyState">No available servers.</p>`;
      return;
    }

    mount.innerHTML = `<select id="guildSwitcherSelect" class="nativeHidden"></select><div id="guildSwitcherSelect_custom"></div>`;
    const s = $("guildSwitcherSelect");
    s.appendChild(makeOption("", "Select a server", state.guildId || ""));
    state.guilds.forEach((g) => s.appendChild(makeOption(g.id, g.name, state.guildId || "")));

    buildSelect("guildSwitcherSelect", () => {
      const id = $("guildSwitcherSelect").value;
      if (id) goGuildPage("overview", id);
      else goHome();
    });
  };

  const loadGuild = async (id) => {
    state.guild = await api(`/api/guild/${id}/settings`);
    state.guildId = id;
    renderGuildSwitcher();
  };

  const metric = (label, value, sub = "", spark = true) => `
    <div class="statCard">
      <span class="statLabel">${esc(label)}</span>
      <div class="statValue">${esc(value)}</div>
      <div class="statSub">${esc(sub)}</div>
      ${spark ? `<div class="sparkline"></div>` : ""}
    </div>
  `;

  const tableRows = (rows) =>
    rows
      .map(
        (r, i) => `
      <div class="tableRow">
        <div class="rankBadge">${i + 1}</div>
        <div>
          <div>${esc(r.title)}</div>
          <div class="tableMeta">${esc(r.sub || "")}</div>
        </div>
        <div class="tableValue">${esc(r.value ?? "")}</div>
      </div>
    `
      )
      .join("");

  const linePath = (series) => {
    const w = 1000;
    const h = 260;
    const pad = 24;
    const vals = series.map((x) => Number(x.value || 0));
    const max = Math.max(...vals, 1);

    return series
      .map((p, i) => {
        const x = pad + (i * (w - pad * 2)) / Math.max(series.length - 1, 1);
        const y = h - pad - (Number(p.value || 0) / max) * (h - pad * 2);
        return `${i ? "L" : "M"} ${x} ${y}`;
      })
      .join(" ");
  };

  const chartSvg = (series) => {
    const labels = series
      .map((s, i) => {
        const x = 24 + (i * 952) / Math.max(series.length - 1, 1);
        return `<text x="${x}" y="250" text-anchor="middle" fill="rgba(255,255,255,.45)" font-size="12">${esc((s.day || "").slice(5))}</text>`;
      })
      .join("");

    return `
      <svg viewBox="0 0 1000 260" class="realChart" preserveAspectRatio="none">
        ${[1, 2, 3, 4].map((i) => `<line x1="24" y1="${i * 50}" x2="976" y2="${i * 50}" stroke="rgba(255,255,255,.05)" />`).join("")}
        <path d="${linePath(series)}" fill="none" stroke="url(#g)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
        <defs>
          <linearGradient id="g" x1="0%" x2="100%">
            <stop offset="0%" stop-color="#7ea0ff"></stop>
            <stop offset="100%" stop-color="#9c7bff"></stop>
          </linearGradient>
        </defs>
        ${labels}
      </svg>
    `;
  };

  const heroHome = async () => {
    const h = await api("/api/health");

    return `
      <div class="heroPanel routeView">
        <div class="heroGlow"></div>
        <div class="heroContent">
          <div>
            <h3 class="heroTitle">System Overview</h3>
            <p class="heroText">Live bot status and dashboard workspace access.</p>
          </div>
          <div class="statGrid">
            ${metric("Bot", h.bot?.tag || "Offline", "Connected identity", false)}
            ${metric("Guilds", h.guilds ?? "Unknown", "Servers currently loaded")}
            ${metric("Uptime", fmtUptime(h.uptime), "Current process runtime")}
            ${metric("Mode", "Phase 3", "Workspace expansion")}
          </div>
        </div>
      </div>
    `;
  };

  const renderHome = async () => {
    setTop("Dashboard", "Choose a server to open its workspace and analytics.", "Dashboard", false, false);
    activeNav(null);

    const cards = state.guilds.length
      ? state.guilds
          .map(
            (g) => `
          <div class="quickCard" onclick="Dashboard.goGuildPage('overview','${g.id}')">
            <h4>${esc(g.name)}</h4>
            <p>${g.memberCount ?? "?"} members · Open workspace overview</p>
          </div>
        `
          )
          .join("")
      : `<p class="emptyState">No admin-accessible servers found.</p>`;

    $("viewRoot").innerHTML = `
      <div class="routeView">
        ${await heroHome()}
        <div class="contentGrid">
          <div class="panelCard">
            <div class="panelHeader">
              <div>
                <h3 class="panelTitle">Your Servers</h3>
                <p class="panelSubtitle">Select a guild to open its dedicated control panel.</p>
              </div>
            </div>
            <div class="quickGrid">${cards}</div>
          </div>
        </div>
      </div>
    `;
  };

  const overview = async () => {
    const g = state.guild;
    const id = state.guildId;

    const [summary, messages, channels, users, commands, moderation, voice] = await Promise.all([
      api(`/api/guild/${id}/analytics/summary?days=30`),
      api(`/api/guild/${id}/analytics/messages?days=30`),
      api(`/api/guild/${id}/analytics/channels?days=30`),
      api(`/api/guild/${id}/analytics/users?days=30`),
      api(`/api/guild/${id}/analytics/commands?days=30`),
      api(`/api/guild/${id}/analytics/moderation?days=30`),
      api(`/api/guild/${id}/analytics/voice?days=30`),
    ]);

    setTop(g.guild.name, "High-level summary of this server’s bot systems and live activity.", `${g.guild.name} / Overview`, false, true);
    activeNav("overview");

    $("viewRoot").innerHTML = `
      <div class="routeView">
        <div class="statGrid">
          ${metric("Messages", summary.messages, "Last 30 days")}
          ${metric("Reactions", summary.reactions, "Tracked reaction adds")}
          ${metric("Voice Hours", (summary.voiceSeconds / 3600).toFixed(1), "Tracked voice activity")}
          ${metric("Mod Actions", summary.moderationActions, "Tracked moderation events")}
        </div>

        <div class="contentGrid" style="margin-top:18px;">
          <div class="gridTwo">
            <div class="panelCard">
              <div class="panelHeader">
                <div>
                  <h3 class="panelTitle">Activity Snapshot</h3>
                  <p class="panelSubtitle">Messages over the last 30 days.</p>
                </div>
              </div>
              <div class="fakeChart">${chartSvg(messages.series)}</div>
            </div>

            <div class="listCard">
              <div class="listHeader">
                <div>
                  <h3 class="listTitle">Recent Activity Feed</h3>
                  <p class="listSubtitle">Most recent tracked moderation activity.</p>
                </div>
              </div>
              <div class="tableList">
                ${
                  moderation.recent.length
                    ? tableRows(
                        moderation.recent.slice(0, 6).map((r) => ({
                          title: `${r.actionType} → ${r.targetName}`,
                          sub: `By ${r.moderatorName}${r.reason ? ` · ${r.reason}` : ""}`,
                          value: new Date(r.createdAt).toLocaleDateString(),
                        }))
                      )
                    : `<p class="emptyState">No tracked actions yet.</p>`
                }
              </div>
            </div>
          </div>

          <div class="gridTwo">
            <div class="listCard">
              <div class="listHeader">
                <div>
                  <h3 class="listTitle">Top Channels</h3>
                  <p class="listSubtitle">Most active channels by messages.</p>
                </div>
              </div>
              <div class="tableList">
                ${tableRows(channels.rows.map((r) => ({ title: `# ${r.name}`, sub: "Messages", value: r.total })))}
              </div>
            </div>

            <div class="listCard">
              <div class="listHeader">
                <div>
                  <h3 class="listTitle">Top Users</h3>
                  <p class="listSubtitle">Most active members by messages.</p>
                </div>
              </div>
              <div class="tableList">
                ${tableRows(users.rows.map((r) => ({ title: r.name, sub: "Messages", value: r.total })))}
              </div>
            </div>
          </div>

          <div class="quickGrid">
            <div class="quickCard" onclick="Dashboard.goGuildPage('analytics')">
              <h4>Top Commands</h4>
              <p>${commands.top[0] ? `${commands.top[0].commandName} leads with ${commands.top[0].total}` : "No command data yet"}</p>
            </div>
            <div class="quickCard" onclick="Dashboard.goGuildPage('analytics')">
              <h4>Voice Leader</h4>
              <p>${voice.rows[0] ? `${voice.rows[0].name} · ${fmtDur(voice.rows[0].totalSeconds)}` : "No voice data yet"}</p>
            </div>
            <div class="quickCard" onclick="Dashboard.goGuildPage('logs')">
              <h4>Logs</h4>
              <p>Open the dedicated logs page for moderation activity.</p>
            </div>
            <div class="quickCard" onclick="Dashboard.goGuildPage('automation')">
              <h4>Automation</h4>
              <p>Configure future workflows and recurring systems.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const moderationPage = () => {
    const g = state.guild;
    const s = g.settings || {};

    setTop("Moderation", "Configure moderation output channels and future enforcement tools.", `${g.guild.name} / Moderation`, true, true);
    activeNav("moderation");

    $("viewRoot").innerHTML = `
      <div class="routeView">
        <div id="saveStatus" class="saveStatus"></div>
        <div class="sectionGrid">
          <div class="settingCard">
            <label for="modLogChannel">Mod Log Channel</label>
            <select id="modLogChannel" class="nativeHidden"></select>
            <div id="modLogChannel_custom"></div>
            <div class="fieldHelp">Where moderation logs and case output will be sent.</div>
          </div>
          <div class="settingCard">
            <label for="purgeArchiveChannel">Purge Archive Channel</label>
            <select id="purgeArchiveChannel" class="nativeHidden"></select>
            <div id="purgeArchiveChannel_custom"></div>
            <div class="fieldHelp">Where archived purge results should be stored.</div>
          </div>
        </div>
      </div>
    `;

    fillSelect("modLogChannel", g.channels, s.mod_log_channel_id || "");
    fillSelect("purgeArchiveChannel", g.channels, s.purge_archive_channel_id || "");
  };

  const jailPage = () => {
    const g = state.guild;
    const j = g.jail || {};

    setTop("Jail", "Manage jail role and jail channel behavior.", `${g.guild.name} / Jail`, true, true);
    activeNav("jail");

    $("viewRoot").innerHTML = `
      <div class="routeView">
        <div id="saveStatus" class="saveStatus"></div>
        <div class="sectionGrid">
          <div class="settingCard">
            <label for="jailChannel">Jail Channel</label>
            <select id="jailChannel" class="nativeHidden"></select>
            <div id="jailChannel_custom"></div>
            <div class="fieldHelp">Channel jailed users are still allowed to access.</div>
          </div>
          <div class="settingCard">
            <label for="jailRole">Jail Role</label>
            <select id="jailRole" class="nativeHidden"></select>
            <div id="jailRole_custom"></div>
            <div class="fieldHelp">Role applied to jailed users when the command executes.</div>
          </div>
        </div>
      </div>
    `;

    fillSelect("jailChannel", g.channels, j.jail_channel_id || "");
    fillSelect("jailRole", g.roles, j.jail_role_id || "");
  };

  const loadCommandRoles = async () => {
    const commandName = $("commandSelect")?.value;
    if (!commandName) return;

    try {
      const data = await api(`/api/guild/${state.guildId}/command-roles/${encodeURIComponent(commandName)}`);
      state.rolePickerApi = buildMultiRolePicker("rolePermissionsPicker", state.guild.roles, data.roleIds || []);
      $("selectedRoleCount").textContent = `${(data.roles || []).length} selected`;
      $("selectedRoleChips").innerHTML =
        data.roles?.length
          ? data.roles.map((r) => `<span class="roleChip">${esc(r.name)}</span>`).join("")
          : `<span class="emptyChip">None configured.</span>`;
    } catch (e) {
      setSaveStatus(e.message || "Failed to load role permissions.", "error");
    }
  };

  const rolePermissionsPage = async () => {
    const g = state.guild;

    setTop("Role Permissions", "Choose which roles are allowed to use selected commands.", `${g.guild.name} / Role Permissions`, false, true);
    activeNav("role-permissions");

    $("viewRoot").innerHTML = `
      <div class="routeView">
        <div id="saveStatus" class="saveStatus"></div>
        <div class="sectionGrid">
          <div class="settingCard">
            <label for="commandSelect">Command</label>
            <select id="commandSelect" class="nativeHidden"></select>
            <div id="commandSelect_custom"></div>
            <div class="fieldHelp">Pick the command you want to lock down.</div>
          </div>
          <div class="settingCard">
            <label>Allowed Roles</label>
            <div id="rolePermissionsPicker"></div>
            <div class="fieldHelp">Search, add, and remove roles without the ugly native multi-select.</div>
          </div>
        </div>

        <div class="panelCard" style="margin-top:18px;">
          <div class="panelHeader">
            <div>
              <h3 class="panelTitle">Currently Allowed Roles</h3>
              <p class="panelSubtitle"><span id="selectedRoleCount">0 selected</span></p>
            </div>
          </div>
          <div id="selectedRoleChips" class="chipWrap"><span class="emptyChip">None configured.</span></div>
          <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">
            <button class="primaryButton" onclick="Dashboard.saveCommandRoles()">Save Role Permissions</button>
            <button class="ghostButton" onclick="Dashboard.clearCommandRoles()">Clear Role Permissions</button>
          </div>
        </div>
      </div>
    `;

    const s = $("commandSelect");
    s.innerHTML = "";
    state.guild.commands.forEach((c) => s.appendChild(makeOption(c.name, `${c.name} (${c.category})`)));
    buildSelect("commandSelect", loadCommandRoles);
    await loadCommandRoles();
  };

  const renderCommandsGrid = () => {
    const search = ($("commandSearch")?.value || "").trim().toLowerCase();
    const category = $("commandCategoryFilter")?.value || "all";
    const list = $("commandsGrid");

    const rows = state.guild.commands.filter((cmd) => {
      const hay = [
        cmd.name,
        cmd.description,
        ...(cmd.aliases || []),
        cmd.category,
        cmd.prefixUsage || "",
        cmd.slashUsage || "",
        cmd.options || "",
      ]
        .join(" ")
        .toLowerCase();

      return (category === "all" || cmd.category === category) && (!search || hay.includes(search));
    });

    list.innerHTML = rows.length
      ? rows
          .map(
            (cmd) => `
        <div class="commandCard">
          <div class="commandHeader">
            <div>
              <h4>${esc(cmd.name)}</h4>
              <p>${esc(cmd.description || "No description provided.")}</p>
            </div>
            <span class="categoryBadge">${esc(cmd.category)}</span>
          </div>
          <div class="commandMetaGrid">
            <div class="commandMetaItem"><span class="metaLabel">Prefix</span><code>${esc(cmd.prefixUsage || "Not available")}</code></div>
            <div class="commandMetaItem"><span class="metaLabel">Slash</span><code>${esc(cmd.slashUsage || "Not available")}</code></div>
            <div class="commandMetaItem"><span class="metaLabel">Aliases</span><span>${cmd.aliases?.length ? esc(cmd.aliases.join(", ")) : "None"}</span></div>
            <div class="commandMetaItem"><span class="metaLabel">Options</span><span>${esc(cmd.options || "No options")}</span></div>
          </div>
        </div>
      `
          )
          .join("")
      : `<p class="emptyState">No commands matched that filter.</p>`;
  };

  const commandsPage = () => {
    const g = state.guild;

    setTop("Commands", "Browse loaded commands, usage, aliases, and categories.", `${g.guild.name} / Commands`, false, true);
    activeNav("commands");

    $("viewRoot").innerHTML = `
      <div class="routeView">
        <div class="commandsToolbar">
          <input id="commandSearch" class="commandSearch" type="text" placeholder="Search commands..." />
          <select id="commandCategoryFilter" class="nativeHidden"></select>
          <div id="commandCategoryFilter_custom"></div>
        </div>
        <div id="commandsGrid" class="commandsGrid"></div>
      </div>
    `;

    $("commandSearch").oninput = renderCommandsGrid;

    const s = $("commandCategoryFilter");
    s.innerHTML = "";
    s.appendChild(makeOption("all", "All Categories", "all"));
    [...new Set(state.guild.commands.map((c) => c.category).filter(Boolean))]
      .sort()
      .forEach((cat) => s.appendChild(makeOption(cat, cat, "all")));

    buildSelect("commandCategoryFilter", renderCommandsGrid);
    renderCommandsGrid();
  };

  const analyticsPage = async () => {
    const g = state.guild;
    const id = state.guildId;

    const [summary, messages, channels, users, commands, voice] = await Promise.all([
      api(`/api/guild/${id}/analytics/summary?days=30`),
      api(`/api/guild/${id}/analytics/messages?days=30`),
      api(`/api/guild/${id}/analytics/channels?days=30`),
      api(`/api/guild/${id}/analytics/users?days=30`),
      api(`/api/guild/${id}/analytics/commands?days=30`),
      api(`/api/guild/${id}/analytics/voice?days=30`),
    ]);

    setTop("Analytics", "Live tracked analytics for this guild.", `${g.guild.name} / Analytics`, false, true);
    activeNav("analytics");

    $("viewRoot").innerHTML = `
      <div class="routeView">
        <div class="statGrid">
          ${metric("Messages", summary.messages, "Last 30 days")}
          ${metric("Reactions", summary.reactions, "Last 30 days")}
          ${metric("Voice Hours", (summary.voiceSeconds / 3600).toFixed(1), "Last 30 days")}
          ${metric("Mod Actions", summary.moderationActions, "Last 30 days")}
        </div>

        <div class="contentGrid" style="margin-top:18px;">
          <div class="panelCard">
            <div class="panelHeader">
              <div>
                <h3 class="panelTitle">Message Activity</h3>
                <p class="panelSubtitle">Messages over the last 30 days.</p>
              </div>
            </div>
            <div class="fakeChart">${chartSvg(messages.series)}</div>
          </div>

          <div class="gridTwo">
            <div class="listCard">
              <div class="listHeader">
                <div>
                  <h3 class="listTitle">Top Channels</h3>
                  <p class="listSubtitle">Most active channels by messages.</p>
                </div>
              </div>
              <div class="tableList">
                ${tableRows(channels.rows.map((r) => ({ title: `# ${r.name}`, sub: "Messages", value: r.total })))}
              </div>
            </div>

            <div class="listCard">
              <div class="listHeader">
                <div>
                  <h3 class="listTitle">Top Users</h3>
                  <p class="listSubtitle">Most active members by messages.</p>
                </div>
              </div>
              <div class="tableList">
                ${tableRows(users.rows.map((r) => ({ title: r.name, sub: "Messages", value: r.total })))}
              </div>
            </div>
          </div>

          <div class="gridTwo">
            <div class="listCard">
              <div class="listHeader">
                <div>
                  <h3 class="listTitle">Top Commands</h3>
                  <p class="listSubtitle">Most used commands.</p>
                </div>
              </div>
              <div class="tableList">
                ${tableRows(commands.top.map((r) => ({ title: r.commandName, sub: "Uses", value: r.total })))}
              </div>
            </div>

            <div class="listCard">
              <div class="listHeader">
                <div>
                  <h3 class="listTitle">Voice Leaderboard</h3>
                  <p class="listSubtitle">Most voice time tracked.</p>
                </div>
              </div>
              <div class="tableList">
                ${tableRows(voice.rows.map((r) => ({ title: r.name, sub: "Voice time", value: fmtDur(r.totalSeconds) })))}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const logsPage = async () => {
    const g = state.guild;
    const moderation = await api(`/api/guild/${state.guildId}/analytics/moderation?days=30`);

    setTop("Logs", "Recent moderation activity and tracked enforcement actions.", `${g.guild.name} / Logs`, false, true);
    activeNav("logs");

    $("viewRoot").innerHTML = `
      <div class="routeView">
        <div class="panelCard">
          <div class="panelHeader">
            <div>
              <h3 class="panelTitle">Recent Moderation Logs</h3>
              <p class="panelSubtitle">Latest tracked moderation actions from analytics.</p>
            </div>
          </div>
          <div class="tableList">
            ${
              moderation.recent.length
                ? tableRows(
                    moderation.recent.map((r) => ({
                      title: `${r.actionType} → ${r.targetName}`,
                      sub: `By ${r.moderatorName}${r.reason ? ` · ${r.reason}` : ""}`,
                      value: new Date(r.createdAt).toLocaleString(),
                    }))
                  )
                : `<p class="emptyState">No moderation logs yet.</p>`
            }
          </div>
        </div>
      </div>
    `;
  };

  const automationPage = () => {
    const g = state.guild;

    setTop("Automation", "Future automation center for reminders, workflows, and moderation systems.", `${g.guild.name} / Automation`, false, true);
    activeNav("automation");

    $("viewRoot").innerHTML = `
      <div class="routeView">
        <div class="quickGrid">
          <div class="quickCard"><h4>AFK System</h4><p>Currently active in bot logic. Dashboard controls can be added next.</p></div>
          <div class="quickCard"><h4>Temp Bans</h4><p>Restore system already exists. Future page can show active timers.</p></div>
          <div class="quickCard"><h4>Scheduled Rules</h4><p>Future place for repeating moderation jobs and reminders.</p></div>
          <div class="quickCard"><h4>Alert Center</h4><p>Future system for threshold-based notifications and logs.</p></div>
        </div>

        <div class="panelCard" style="margin-top:18px;">
          <div class="panelHeader">
            <div>
              <h3 class="panelTitle">Planned Automation Modules</h3>
              <p class="panelSubtitle">Architecture placeholder for future backend systems.</p>
            </div>
          </div>
          <div class="tableList">
            ${tableRows([
              { title: "Active temp punishments", sub: "Show current timed bans/timeouts", value: "Planned" },
              { title: "Auto moderation presets", sub: "Thresholds and presets", value: "Planned" },
              { title: "Keyword monitors", sub: "Watchlist and alerts", value: "Planned" },
              { title: "Recurring maintenance", sub: "Scheduled cleanup and archive jobs", value: "Planned" },
            ])}
          </div>
        </div>
      </div>
    `;
  };

  const settingsPage = () => {
    const g = state.guild;

    setTop("Settings", "Combined guild system overview and workspace routing.", `${g.guild.name} / Settings`, false, true);
    activeNav("settings");

    $("viewRoot").innerHTML = `
      <div class="routeView">
        <div class="quickGrid">
          <div class="quickCard" onclick="Dashboard.goGuildPage('moderation')"><h4>Moderation</h4><p>Configure mod log and purge archive channels.</p></div>
          <div class="quickCard" onclick="Dashboard.goGuildPage('jail')"><h4>Jail</h4><p>Manage jail role and jail channel settings.</p></div>
          <div class="quickCard" onclick="Dashboard.goGuildPage('role-permissions')"><h4>Role Permissions</h4><p>Per-command allowed role mapping.</p></div>
          <div class="quickCard" onclick="Dashboard.goGuildPage('commands')"><h4>Commands</h4><p>Browse loaded commands and usage data.</p></div>
        </div>
      </div>
    `;
  };

  const saveGuildSettings = async (page) => {
    const payload = {};

    if (page === "moderation") {
      payload.modLogChannelId = $("modLogChannel")?.value || null;
      payload.purgeArchiveChannelId = $("purgeArchiveChannel")?.value || null;
    }

    if (page === "jail") {
      payload.jailChannelId = $("jailChannel")?.value || null;
      payload.jailRoleId = $("jailRole")?.value || null;
    }

    setSaveStatus("Saving settings...");

    try {
      await api(`/api/guild/${state.guildId}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      await loadGuild(state.guildId);

      if (page === "moderation") moderationPage();
      if (page === "jail") jailPage();

      setSaveStatus("Saved successfully.", "success");
    } catch (e) {
      setSaveStatus(e.message || "Failed to save settings.", "error");
    }
  };

  const saveCommandRoles = async () => {
    const commandName = $("commandSelect")?.value;
    if (!commandName) {
      setSaveStatus("Choose a command first.", "error");
      return;
    }

    setSaveStatus("Saving role permissions...");

    try {
      await api(`/api/guild/${state.guildId}/command-roles/${encodeURIComponent(commandName)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: state.rolePickerApi ? state.rolePickerApi.getValues() : [] }),
      });

      await loadCommandRoles();
      setSaveStatus(`Saved role permissions for ${commandName}.`, "success");
    } catch (e) {
      setSaveStatus(e.message || "Failed to save role permissions.", "error");
    }
  };

  const clearCommandRoles = async () => {
    const commandName = $("commandSelect")?.value;
    if (!commandName) {
      setSaveStatus("Choose a command first.", "error");
      return;
    }

    setSaveStatus("Clearing role permissions...");

    try {
      await api(`/api/guild/${state.guildId}/command-roles/${encodeURIComponent(commandName)}`, {
        method: "DELETE",
      });

      await loadCommandRoles();
      setSaveStatus(`Cleared role permissions for ${commandName}.`, "success");
    } catch (e) {
      setSaveStatus(e.message || "Failed to clear role permissions.", "error");
    }
  };

  const saveCurrentPage = async () => {
    const r = route();

    if (r.type !== "guild") return;

    if (r.page === "moderation") {
      await saveGuildSettings("moderation");
      return;
    }

    if (r.page === "jail") {
      await saveGuildSettings("jail");
      return;
    }

    setSaveStatus("This page does not support Save Changes.", "error");
  };

  const render = async () => {
    const authed = await loadMe();

    if (!authed) {
      state.guildId = null;
      state.guild = null;
      $("viewRoot").innerHTML = "";
      $("guildNavGroup").style.display = "none";
      setTop("Welcome", "Login to open your server workspaces.", "Dashboard", false, false);
      return;
    }

    await loadGuilds();
    const r = route();

    if (r.type === "home") {
      state.guildId = null;
      state.guild = null;
      return renderHome();
    }

    try {
      await loadGuild(r.id);

      if (r.page === "overview") return overview();
      if (r.page === "moderation") return moderationPage();
      if (r.page === "jail") return jailPage();
      if (r.page === "role-permissions") return rolePermissionsPage();
      if (r.page === "commands") return commandsPage();
      if (r.page === "analytics") return analyticsPage();
      if (r.page === "logs") return logsPage();
      if (r.page === "automation") return automationPage();
      if (r.page === "settings") return settingsPage();

      return goGuildPage("overview", r.id);
    } catch (e) {
      $("viewRoot").innerHTML = `
        <div class="authNotice routeView">
          <h3>Guild load failed</h3>
          <p>${esc(e.message || "Failed to load guild data.")}</p>
          <button class="primaryButton" onclick="Dashboard.goHome()">Return Home</button>
        </div>
      `;
    }
  };

  window.addEventListener("popstate", render);

  return {
    init: render,
    goHome,
    goGuildPage,
    loginWithDiscord: () => {
      location.href = "/auth/login";
    },
    logout: async () => {
      await fetch("/auth/logout", { method: "POST" });
      location.href = "/";
    },
    saveCurrentPage,
    saveCommandRoles,
    clearCommandRoles,
  };
})();

window.Dashboard = Dashboard;
window.addEventListener("DOMContentLoaded", Dashboard.init);