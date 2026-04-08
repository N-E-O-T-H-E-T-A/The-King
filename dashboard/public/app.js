const Dashboard = (() => {
  const state = {
    me: null,
    guilds: [],
    selectedGuildId: null,
    selectedGuildData: null,
    currentPage: "home",
  };

  function qs(id) {
    return document.getElementById(id);
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatUptime(seconds) {
    const total = Math.floor(seconds || 0);
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;

    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);
    return parts.join(" ");
  }

  function makeOption(value, label, selectedValue = null) {
    const option = document.createElement("option");
    option.value = value ?? "";
    option.textContent = label;
    if ((selectedValue ?? "") === (value ?? "")) option.selected = true;
    return option;
  }

  function setSaveStatus(text, type = "") {
    const el = qs("saveStatus");
    if (!el) return;
    el.textContent = text;
    el.className = `saveStatus ${type}`.trim();
  }

  function closeAllCustomSelects(except = null) {
    document.querySelectorAll(".customSelect").forEach((select) => {
      if (select !== except) {
        select.classList.remove("open");
      }
    });
  }

  function buildCustomSelect(selectId, onChangeCallback = null) {
    const select = qs(selectId);
    const mount = qs(`${selectId}_custom`);
    if (!select || !mount) return;

    const selectedOption = select.options[select.selectedIndex] || select.options[0];
    const options = [...select.options];

    mount.innerHTML = `
      <div class="customSelect">
        <button type="button" class="customSelectTrigger">
          <span class="customSelectValue">${escapeHtml(selectedOption ? selectedOption.textContent : "None")}</span>
          <span class="customSelectArrow">▾</span>
        </button>
        <div class="customSelectMenu">
          <div class="customSelectSearchWrap">
            <input type="text" class="customSelectSearch" placeholder="Search..." />
          </div>
          <div class="customSelectOptions"></div>
        </div>
      </div>
    `;

    const wrapper = mount.querySelector(".customSelect");
    const trigger = mount.querySelector(".customSelectTrigger");
    const valueText = mount.querySelector(".customSelectValue");
    const optionsWrap = mount.querySelector(".customSelectOptions");
    const search = mount.querySelector(".customSelectSearch");

    function renderOptions(filter = "") {
      const q = filter.trim().toLowerCase();

      const filtered = options.filter((opt) =>
        opt.textContent.toLowerCase().includes(q)
      );

      optionsWrap.innerHTML = filtered
        .map((opt) => `
          <button
            type="button"
            class="customSelectOption ${opt.value === select.value ? "active" : ""}"
            data-value="${escapeHtml(opt.value)}"
          >
            ${escapeHtml(opt.textContent)}
          </button>
        `)
        .join("");

      optionsWrap.querySelectorAll(".customSelectOption").forEach((btn) => {
        btn.addEventListener("click", () => {
          select.value = btn.dataset.value;
          const match = [...select.options].find((opt) => opt.value === btn.dataset.value);
          valueText.textContent = match ? match.textContent : "None";
          wrapper.classList.remove("open");

          if (typeof onChangeCallback === "function") {
            onChangeCallback();
          }
        });
      });
    }

    renderOptions();

    trigger.addEventListener("click", () => {
      const isOpen = wrapper.classList.contains("open");
      closeAllCustomSelects(wrapper);
      wrapper.classList.toggle("open", !isOpen);

      if (!isOpen) {
        search.value = "";
        renderOptions("");
        setTimeout(() => search.focus(), 0);
      }
    });

    search.addEventListener("input", () => {
      renderOptions(search.value);
    });
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".customSelect")) {
      closeAllCustomSelects();
    }
  });

  function fillSelect(selectId, items, selectedValue, labelKey = "name") {
    const select = qs(selectId);
    select.innerHTML = "";
    select.appendChild(makeOption("", "None", selectedValue));

    for (const item of items) {
      select.appendChild(makeOption(item.id, item[labelKey], selectedValue));
    }

    buildCustomSelect(selectId);
  }

  function fillCommandSelect(commands) {
    const select = qs("commandSelect");
    const previous = select.value;
    select.innerHTML = "";

    for (const command of commands) {
      const label = `${command.name} (${command.category})`;
      select.appendChild(makeOption(command.name, label, previous));
    }

    if (!select.value && commands.length) {
      select.value = commands[0].name;
    }

    buildCustomSelect("commandSelect", loadCommandRoles);
  }

  function fillCommandCategoryFilter(commands) {
    const select = qs("commandCategoryFilter");
    const previous = select.value || "all";
    const categories = [...new Set(commands.map((cmd) => cmd.category).filter(Boolean))].sort();

    select.innerHTML = "";
    select.appendChild(makeOption("all", "All Categories", previous));

    for (const category of categories) {
      select.appendChild(makeOption(category, category, previous));
    }

    if (![...select.options].some((opt) => opt.value === previous)) {
      select.value = "all";
    }

    buildCustomSelect("commandCategoryFilter", renderCommandsPage);
  }

  function fillRoleMultiSelect(roles, selectedIds = []) {
    const select = qs("rolePermissionsSelect");
    if (!select) return;

    select.innerHTML = "";
    for (const role of roles) {
      const option = makeOption(role.id, role.name);
      option.selected = selectedIds.includes(role.id);
      select.appendChild(option);
    }
  }

  function getSelectedMultiValues(selectId) {
    return [...qs(selectId).selectedOptions].map((opt) => opt.value);
  }

  async function api(url, options = {}) {
    const res = await fetch(url, options);
    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const data = isJson ? await res.json() : await res.text();

    if (!res.ok) {
      const message = typeof data === "object" ? data.error || "Request failed" : data;
      throw new Error(message);
    }

    return data;
  }

  async function loadMe() {
    const data = await api("/api/me");
    state.me = data.user || null;

    const authNotice = qs("authNotice");
    const loginButton = qs("loginButton");
    const userBadge = qs("userBadge");

    if (!data.authenticated) {
      authNotice.style.display = "block";
      loginButton.style.display = "inline-flex";
      userBadge.style.display = "none";
      return false;
    }

    authNotice.style.display = "none";
    loginButton.style.display = "none";
    userBadge.style.display = "flex";
    qs("userName").textContent = data.user?.global_name || data.user?.username || "User";
    qs("userAvatarInitial").textContent = (data.user?.global_name || data.user?.username || "U").charAt(0).toUpperCase();
    return true;
  }

  async function loadHealth() {
    const data = await api("/api/health");
    const hero = `
      <div class="heroPanel routeView">
        <div class="heroGlow"></div>
        <div class="heroContent">
          <div>
            <h3 class="heroTitle">System Overview</h3>
            <p class="heroText">Live status for your bot and current workspace.</p>
          </div>

          <div class="statGrid">
            <div class="statCard">
              <span class="statLabel">Bot</span>
              <div class="statValue">${escapeHtml(data.bot?.tag || "Offline")}</div>
              <div class="statSub">Connected identity</div>
            </div>

            <div class="statCard">
              <span class="statLabel">Guilds</span>
              <div class="statValue">${escapeHtml(data.guilds ?? "Unknown")}</div>
              <div class="statSub">Servers currently loaded</div>
              <div class="sparkline"></div>
            </div>

            <div class="statCard">
              <span class="statLabel">Uptime</span>
              <div class="statValue">${escapeHtml(formatUptime(data.uptime))}</div>
              <div class="statSub">Current process runtime</div>
              <div class="sparkline"></div>
            </div>

            <div class="statCard">
              <span class="statLabel">Mode</span>
              <div class="statValue">Phase 1</div>
              <div class="statSub">UI shell online</div>
              <div class="sparkline"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    return hero;
  }

  async function loadGuilds() {
    try {
      state.guilds = await api("/api/guilds");
    } catch {
      state.guilds = [];
    }

    renderGuildSwitcher();
  }

  function renderGuildSwitcher() {
    const mount = qs("guildSwitcherMount");

    if (!state.guilds.length) {
      mount.innerHTML = `<p class="emptyState">No available servers.</p>`;
      return;
    }

    const current = state.selectedGuildId || "";
    const selectId = "guildSwitcherSelect";

    mount.innerHTML = `
      <select id="${selectId}" class="nativeHidden"></select>
      <div id="${selectId}_custom"></div>
    `;

    const select = qs(selectId);
    select.appendChild(makeOption("", "Select a server", current));

    for (const guild of state.guilds) {
      select.appendChild(makeOption(guild.id, guild.name, current));
    }

    buildCustomSelect(selectId, () => {
      const id = qs(selectId).value;
      if (!id) {
        goHome();
        return;
      }
      goGuildPage("overview", id);
    });
  }

  function setTopbar(title, subtitle, breadcrumb, { showSave = false, showBack = false } = {}) {
    qs("pageTitle").textContent = title;
    qs("pageSubtitle").textContent = subtitle;
    qs("breadcrumb").textContent = breadcrumb;
    qs("saveButton").style.display = showSave ? "inline-flex" : "none";
    qs("backButton").style.display = showBack ? "inline-flex" : "none";
  }

  function setActiveNav(page = null) {
    document.querySelectorAll(".navItem").forEach((item) => {
      item.classList.remove("active");
    });

    if (!page && window.location.pathname === "/") {
      const home = document.querySelector('.navItem[data-route="/"]');
      if (home) home.classList.add("active");
    }

    if (page) {
      const match = document.querySelector(`.navItem[data-page="${page}"]`);
      if (match) match.classList.add("active");
    }

    qs("guildNavGroup").style.display = state.selectedGuildId ? "flex" : "none";
  }

  function getRoute() {
    const parts = window.location.pathname.split("/").filter(Boolean);

    if (!parts.length) {
      return { type: "home" };
    }

    if (parts[0] === "guild" && parts[1]) {
      return {
        type: "guild",
        guildId: parts[1],
        page: parts[2] || "overview",
      };
    }

    return { type: "home" };
  }

  async function loadGuildData(guildId) {
    const data = await api(`/api/guild/${guildId}/settings`);
    state.selectedGuildId = guildId;
    state.selectedGuildData = data;
    renderGuildSwitcher();
    return data;
  }

  function renderHomePage(heroHtml) {
    setTopbar(
      "Dashboard",
      "Choose a server to open its workspace and manage bot systems.",
      "Dashboard",
      { showSave: false, showBack: false }
    );
    setActiveNav(null);

    const guildCards = state.guilds.length
      ? state.guilds.map((guild) => `
        <div class="quickCard" onclick="Dashboard.goGuildPage('overview', '${guild.id}')">
          <h4>${escapeHtml(guild.name)}</h4>
          <p>${guild.memberCount ?? "?"} members · Open workspace overview</p>
        </div>
      `).join("")
      : `<p class="emptyState">No admin-accessible servers found.</p>`;

    qs("viewRoot").innerHTML = `
      <div class="routeView">
        ${heroHtml}

        <div class="contentGrid">
          <div class="panelCard">
            <div class="panelHeader">
              <div>
                <h3 class="panelTitle">Your Servers</h3>
                <p class="panelSubtitle">Select a guild to open its dedicated control panel.</p>
              </div>
            </div>
            <div class="quickGrid">
              ${guildCards}
            </div>
          </div>

          <div class="gridTwo">
            <div class="panelCard">
              <div class="panelHeader">
                <div>
                  <h3 class="panelTitle">What this panel is becoming</h3>
                  <p class="panelSubtitle">Phase 1 layout foundation for a full production dashboard.</p>
                </div>
              </div>

              <div class="placeholderBlock">
                <div class="placeholderLine long"></div>
                <div class="placeholderLine medium"></div>
                <div class="placeholderLine long"></div>
                <div class="placeholderLine short"></div>
              </div>
            </div>

            <div class="listCard">
              <div class="listHeader">
                <div>
                  <h3 class="listTitle">Planned Modules</h3>
                  <p class="listSubtitle">The next backend-heavy systems to wire in.</p>
                </div>
              </div>

              <div class="tableList">
                ${["Analytics tracking", "Moderation history", "Activity graphs", "Automation center", "Audit logs", "Role access matrix"]
                  .map((name, i) => `
                    <div class="tableRow">
                      <div class="rankBadge">${i + 1}</div>
                      <div>
                        <div>${escapeHtml(name)}</div>
                        <div class="tableMeta">Phase 2 / Phase 3 roadmap</div>
                      </div>
                      <div class="tableValue">Planned</div>
                    </div>
                  `).join("")}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderOverviewPage() {
    const guild = state.selectedGuildData?.guild;
    setTopbar(
      guild?.name || "Overview",
      "High-level summary of this server’s bot systems and future analytics space.",
      `${guild?.name || "Guild"} / Overview`,
      { showSave: false, showBack: true }
    );
    setActiveNav("overview");

    qs("viewRoot").innerHTML = `
      <div class="routeView">
        <div class="statGrid">
          <div class="statCard">
            <span class="statLabel">Server</span>
            <div class="statValue">${escapeHtml(guild?.name || "Unknown")}</div>
            <div class="statSub">Current workspace</div>
          </div>

          <div class="statCard">
            <span class="statLabel">Channels</span>
            <div class="statValue">${escapeHtml(state.selectedGuildData.channels?.length || 0)}</div>
            <div class="statSub">Text-based channels loaded</div>
            <div class="sparkline"></div>
          </div>

          <div class="statCard">
            <span class="statLabel">Roles</span>
            <div class="statValue">${escapeHtml(state.selectedGuildData.roles?.length || 0)}</div>
            <div class="statSub">Assignable roles available</div>
            <div class="sparkline"></div>
          </div>

          <div class="statCard">
            <span class="statLabel">Commands</span>
            <div class="statValue">${escapeHtml(state.selectedGuildData.commands?.length || 0)}</div>
            <div class="statSub">Loaded dashboard-visible commands</div>
            <div class="sparkline"></div>
          </div>
        </div>

        <div class="contentGrid" style="margin-top:18px;">
          <div class="gridTwo">
            <div class="panelCard">
              <div class="panelHeader">
                <div>
                  <h3 class="panelTitle">Activity Snapshot</h3>
                  <p class="panelSubtitle">Placeholder visual until backend event tracking is added.</p>
                </div>
              </div>

              <div class="fakeChart">
                <div class="fakeChartLine"></div>
                <div class="fakeChartStroke"></div>
              </div>
            </div>

            <div class="listCard">
              <div class="listHeader">
                <div>
                  <h3 class="listTitle">Quick Links</h3>
                  <p class="listSubtitle">Open system pages for this guild.</p>
                </div>
              </div>

              <div class="tableList">
                ${[
                  ["Moderation", "Configure mod log and purge archive", "moderation"],
                  ["Jail", "Set jail role and jail channel", "jail"],
                  ["Role Permissions", "Limit commands by role", "role-permissions"],
                  ["Commands", "Browse loaded commands", "commands"],
                  ["Analytics", "Future charts and activity data", "analytics"],
                  ["Settings", "Combined guild settings", "settings"]
                ].map((row, i) => `
                  <div class="tableRow" onclick="Dashboard.goGuildPage('${row[2]}')" style="cursor:pointer;">
                    <div class="rankBadge">${i + 1}</div>
                    <div>
                      <div>${escapeHtml(row[0])}</div>
                      <div class="tableMeta">${escapeHtml(row[1])}</div>
                    </div>
                    <div class="tableValue">Open</div>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>

          <div class="panelCard">
            <div class="panelHeader">
              <div>
                <h3 class="panelTitle">System Preview</h3>
                <p class="panelSubtitle">These cards are ready for future backend data.</p>
              </div>
            </div>

            <div class="quickGrid">
              <div class="quickCard" onclick="Dashboard.goGuildPage('analytics')">
                <h4>Message Trends</h4>
                <p>Daily and weekly server activity charts.</p>
              </div>
              <div class="quickCard" onclick="Dashboard.goGuildPage('analytics')">
                <h4>Top Channels</h4>
                <p>Most active channels and interaction hotspots.</p>
              </div>
              <div class="quickCard" onclick="Dashboard.goGuildPage('moderation')">
                <h4>Moderation Summary</h4>
                <p>Case counts, punishments, and moderator actions.</p>
              </div>
              <div class="quickCard" onclick="Dashboard.goGuildPage('settings')">
                <h4>System Health</h4>
                <p>Feature toggles and dashboard wiring status.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderModerationPage() {
    const settings = state.selectedGuildData.settings || {};

    setTopbar(
      "Moderation",
      "Configure moderation output channels and future enforcement tools.",
      `${state.selectedGuildData.guild.name} / Moderation`,
      { showSave: true, showBack: true }
    );
    setActiveNav("moderation");

    qs("viewRoot").innerHTML = `
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

        <div class="contentGrid" style="margin-top:18px;">
          <div class="panelCard">
            <div class="panelHeader">
              <div>
                <h3 class="panelTitle">Moderation Roadmap</h3>
                <p class="panelSubtitle">Future modules already accounted for in the UI layout.</p>
              </div>
            </div>

            <div class="quickGrid">
              <div class="quickCard"><h4>Cases</h4><p>Case feed and action history.</p></div>
              <div class="quickCard"><h4>Logs</h4><p>Mod audit trail and export support.</p></div>
              <div class="quickCard"><h4>Thresholds</h4><p>Future warning and escalation configs.</p></div>
              <div class="quickCard"><h4>Templates</h4><p>Preset enforcement rule packs later.</p></div>
            </div>
          </div>
        </div>
      </div>
    `;

    fillSelect("modLogChannel", state.selectedGuildData.channels, settings.mod_log_channel_id || "");
    fillSelect("purgeArchiveChannel", state.selectedGuildData.channels, settings.purge_archive_channel_id || "");
  }

  function renderJailPage() {
    const jail = state.selectedGuildData.jail || {};

    setTopbar(
      "Jail",
      "Manage jail role and jail channel behavior.",
      `${state.selectedGuildData.guild.name} / Jail`,
      { showSave: true, showBack: true }
    );
    setActiveNav("jail");

    qs("viewRoot").innerHTML = `
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

        <div class="contentGrid" style="margin-top:18px;">
          <div class="listCard">
            <div class="listHeader">
              <div>
                <h3 class="listTitle">Future Jail Features</h3>
                <p class="listSubtitle">Planned extensions for this module.</p>
              </div>
            </div>

            <div class="tableList">
              ${[
                "Active jailed users list",
                "Role restore snapshots",
                "Release history",
                "Timed jail durations",
                "Reason history"
              ].map((item, i) => `
                <div class="tableRow">
                  <div class="rankBadge">${i + 1}</div>
                  <div><div>${escapeHtml(item)}</div><div class="tableMeta">Planned enhancement</div></div>
                  <div class="tableValue">Soon</div>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      </div>
    `;

    fillSelect("jailChannel", state.selectedGuildData.channels, jail.jail_channel_id || "");
    fillSelect("jailRole", state.selectedGuildData.roles, jail.jail_role_id || "");
  }

  async function renderRolePermissionsPage() {
    setTopbar(
      "Role Permissions",
      "Choose which roles are allowed to use selected commands.",
      `${state.selectedGuildData.guild.name} / Role Permissions`,
      { showSave: false, showBack: true }
    );
    setActiveNav("role-permissions");

    qs("viewRoot").innerHTML = `
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
            <label for="rolePermissionsSelect">Allowed Roles</label>
            <select id="rolePermissionsSelect" class="multiSelect" multiple size="10"></select>
            <div class="fieldHelp">Hold Ctrl or Cmd to select multiple roles.</div>
          </div>
        </div>

        <div class="panelCard" style="margin-top:18px;">
          <div class="panelHeader">
            <div>
              <h3 class="panelTitle">Currently Allowed Roles</h3>
              <p class="panelSubtitle"><span id="selectedRoleCount">0 selected</span></p>
            </div>
          </div>

          <div id="selectedRoleChips" class="chipWrap">
            <span class="emptyChip">None configured.</span>
          </div>

          <div style="margin-top:16px; display:flex; gap:10px; flex-wrap:wrap;">
            <button class="primaryButton" onclick="Dashboard.saveCommandRoles()">Save Role Permissions</button>
            <button class="ghostButton" onclick="Dashboard.clearCommandRoles()">Clear Role Permissions</button>
          </div>
        </div>
      </div>
    `;

    fillCommandSelect(state.selectedGuildData.commands);
    await loadCommandRoles();
  }

  function renderCommandsPage() {
    setTopbar(
      "Commands",
      "Browse loaded commands, usage, aliases, and categories.",
      `${state.selectedGuildData.guild.name} / Commands`,
      { showSave: false, showBack: true }
    );
    setActiveNav("commands");

    qs("viewRoot").innerHTML = `
      <div class="routeView">
        <div class="commandsToolbar">
          <input
            id="commandSearch"
            class="commandSearch"
            type="text"
            placeholder="Search commands..."
          />
          <select id="commandCategoryFilter" class="nativeHidden"></select>
          <div id="commandCategoryFilter_custom"></div>
        </div>

        <div id="commandsGrid" class="commandsGrid"></div>
      </div>
    `;

    qs("commandSearch").addEventListener("input", renderCommandsPageList);
    fillCommandCategoryFilter(state.selectedGuildData.commands);
    renderCommandsPageList();
  }

  function renderCommandsPageList() {
    const list = qs("commandsGrid");
    const search = (qs("commandSearch")?.value || "").trim().toLowerCase();
    const category = qs("commandCategoryFilter")?.value || "all";

    const commands = state.selectedGuildData.commands.filter((cmd) => {
      const matchesCategory = category === "all" || cmd.category === category;
      const haystack = [
        cmd.name,
        cmd.description,
        ...(cmd.aliases || []),
        cmd.category,
        cmd.prefixUsage || "",
        cmd.slashUsage || "",
        cmd.options || "",
      ].join(" ").toLowerCase();

      const matchesSearch = !search || haystack.includes(search);
      return matchesCategory && matchesSearch;
    });

    if (!commands.length) {
      list.innerHTML = `<p class="emptyState">No commands matched that filter.</p>`;
      return;
    }

    list.innerHTML = commands.map((cmd) => `
      <div class="commandCard">
        <div class="commandHeader">
          <div>
            <h4>${escapeHtml(cmd.name)}</h4>
            <p>${escapeHtml(cmd.description || "No description provided.")}</p>
          </div>
          <span class="categoryBadge">${escapeHtml(cmd.category)}</span>
        </div>

        <div class="commandMetaGrid">
          <div class="commandMetaItem">
            <span class="metaLabel">Prefix</span>
            <code>${escapeHtml(cmd.prefixUsage || "Not available")}</code>
          </div>
          <div class="commandMetaItem">
            <span class="metaLabel">Slash</span>
            <code>${escapeHtml(cmd.slashUsage || "Not available")}</code>
          </div>
          <div class="commandMetaItem">
            <span class="metaLabel">Aliases</span>
            <span>${cmd.aliases?.length ? escapeHtml(cmd.aliases.join(", ")) : "None"}</span>
          </div>
          <div class="commandMetaItem">
            <span class="metaLabel">Options</span>
            <span>${escapeHtml(cmd.options || "No options")}</span>
          </div>
        </div>
      </div>
    `).join("");
  }

  function renderAnalyticsPage() {
    setTopbar(
      "Analytics",
      "Activity and engagement layout ready for backend tracking data.",
      `${state.selectedGuildData.guild.name} / Analytics`,
      { showSave: false, showBack: true }
    );
    setActiveNav("analytics");

    qs("viewRoot").innerHTML = `
      <div class="routeView">
        <div class="statGrid">
          <div class="statCard">
            <span class="statLabel">Messages</span>
            <div class="statValue">--</div>
            <div class="statSub">Backend tracker coming in Phase 2</div>
            <div class="sparkline"></div>
          </div>
          <div class="statCard">
            <span class="statLabel">Reactions</span>
            <div class="statValue">--</div>
            <div class="statSub">Will use stored event data</div>
            <div class="sparkline"></div>
          </div>
          <div class="statCard">
            <span class="statLabel">Voice Hours</span>
            <div class="statValue">--</div>
            <div class="statSub">Voice session tracker planned</div>
            <div class="sparkline"></div>
          </div>
          <div class="statCard">
            <span class="statLabel">Actions</span>
            <div class="statValue">--</div>
            <div class="statSub">Mod events and automation later</div>
            <div class="sparkline"></div>
          </div>
        </div>

        <div class="contentGrid" style="margin-top:18px;">
          <div class="panelCard">
            <div class="panelHeader">
              <div>
                <h3 class="panelTitle">Message Activity</h3>
                <p class="panelSubtitle">Chart placeholder with final layout already in place.</p>
              </div>
            </div>
            <div class="fakeChart">
              <div class="fakeChartLine"></div>
              <div class="fakeChartStroke"></div>
            </div>
          </div>

          <div class="gridTwo">
            <div class="listCard">
              <div class="listHeader">
                <div>
                  <h3 class="listTitle">Top Channels</h3>
                  <p class="listSubtitle">Will rank channels once tracking is enabled.</p>
                </div>
              </div>
              <div class="tableList">
                ${[1,2,3,4,5].map((i) => `
                  <div class="tableRow">
                    <div class="rankBadge">${i}</div>
                    <div><div>Channel placeholder</div><div class="tableMeta">Future tracked data</div></div>
                    <div class="tableValue">--</div>
                  </div>
                `).join("")}
              </div>
            </div>

            <div class="listCard">
              <div class="listHeader">
                <div>
                  <h3 class="listTitle">Top Users</h3>
                  <p class="listSubtitle">Future leaderboard block.</p>
                </div>
              </div>
              <div class="tableList">
                ${[1,2,3,4,5].map((i) => `
                  <div class="tableRow">
                    <div class="rankBadge">${i}</div>
                    <div><div>User placeholder</div><div class="tableMeta">Future tracked data</div></div>
                    <div class="tableValue">--</div>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderSettingsPage() {
    setTopbar(
      "Settings",
      "Combined guild system overview and future feature controls.",
      `${state.selectedGuildData.guild.name} / Settings`,
      { showSave: false, showBack: true }
    );
    setActiveNav("settings");

    qs("viewRoot").innerHTML = `
      <div class="routeView">
        <div class="quickGrid">
          <div class="quickCard" onclick="Dashboard.goGuildPage('moderation')">
            <h4>Moderation</h4>
            <p>Configure mod log and purge archive channels.</p>
          </div>
          <div class="quickCard" onclick="Dashboard.goGuildPage('jail')">
            <h4>Jail</h4>
            <p>Manage jail role and jail channel settings.</p>
          </div>
          <div class="quickCard" onclick="Dashboard.goGuildPage('role-permissions')">
            <h4>Role Permissions</h4>
            <p>Per-command allowed role mapping.</p>
          </div>
          <div class="quickCard" onclick="Dashboard.goGuildPage('commands')">
            <h4>Commands</h4>
            <p>Browse loaded commands and usage data.</p>
          </div>
        </div>
      </div>
    `;
  }

  async function loadCommandRoles() {
    if (!state.selectedGuildId || !state.selectedGuildData) return;

    const commandName = qs("commandSelect").value;
    if (!commandName) return;

    try {
      const data = await api(`/api/guild/${state.selectedGuildId}/command-roles/${encodeURIComponent(commandName)}`);
      fillRoleMultiSelect(state.selectedGuildData.roles, data.roleIds || []);

      qs("selectedRoleCount").textContent = `${(data.roles || []).length} selected`;

      const chips = qs("selectedRoleChips");
      if (!data.roles?.length) {
        chips.innerHTML = `<span class="emptyChip">None configured.</span>`;
      } else {
        chips.innerHTML = data.roles
          .map((role) => `<span class="roleChip">${escapeHtml(role.name)}</span>`)
          .join("");
      }
    } catch (error) {
      setSaveStatus(error.message || "Failed to load role permissions.", "error");
    }
  }

  async function saveGuildSettings(page) {
    const payload = {};

    if (page === "moderation") {
      payload.modLogChannelId = qs("modLogChannel").value || null;
      payload.purgeArchiveChannelId = qs("purgeArchiveChannel").value || null;
    }

    if (page === "jail") {
      payload.jailChannelId = qs("jailChannel").value || null;
      payload.jailRoleId = qs("jailRole").value || null;
    }

    setSaveStatus("Saving settings...");

    try {
      await api(`/api/guild/${state.selectedGuildId}/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      setSaveStatus("Saved successfully.", "success");
      await loadGuildData(state.selectedGuildId);
    } catch (error) {
      setSaveStatus(error.message || "Failed to save settings.", "error");
    }
  }

  async function saveCommandRoles() {
    const commandName = qs("commandSelect").value;
    const roleIds = getSelectedMultiValues("rolePermissionsSelect");

    if (!commandName) {
      setSaveStatus("Choose a command first.", "error");
      return;
    }

    setSaveStatus("Saving role permissions...");

    try {
      await api(`/api/guild/${state.selectedGuildId}/command-roles/${encodeURIComponent(commandName)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roleIds }),
      });

      setSaveStatus(`Saved role permissions for ${commandName}.`, "success");
      await loadCommandRoles();
    } catch (error) {
      setSaveStatus(error.message || "Failed to save role permissions.", "error");
    }
  }

  async function clearCommandRoles() {
    const commandName = qs("commandSelect").value;
    if (!commandName) {
      setSaveStatus("Choose a command first.", "error");
      return;
    }

    setSaveStatus("Clearing role permissions...");

    try {
      await api(`/api/guild/${state.selectedGuildId}/command-roles/${encodeURIComponent(commandName)}`, {
        method: "DELETE",
      });

      setSaveStatus(`Cleared role permissions for ${commandName}.`, "success");
      await loadCommandRoles();
    } catch (error) {
      setSaveStatus(error.message || "Failed to clear role permissions.", "error");
    }
  }

  async function renderRoute() {
    const loggedIn = await loadMe();

    if (!loggedIn) {
      qs("viewRoot").innerHTML = "";
      qs("guildNavGroup").style.display = "none";
      setTopbar("Welcome", "Login to open your server workspaces.", "Dashboard", {
        showSave: false,
        showBack: false,
      });
      return;
    }

    await loadGuilds();
    const route = getRoute();

    if (route.type === "home") {
      state.selectedGuildId = null;
      state.selectedGuildData = null;
      const hero = await loadHealth();
      renderHomePage(hero);
      return;
    }

    if (route.type === "guild") {
      try {
        await loadGuildData(route.guildId);

        switch (route.page) {
          case "overview":
            renderOverviewPage();
            break;
          case "moderation":
            renderModerationPage();
            break;
          case "jail":
            renderJailPage();
            break;
          case "role-permissions":
            await renderRolePermissionsPage();
            break;
          case "commands":
            renderCommandsPage();
            break;
          case "analytics":
            renderAnalyticsPage();
            break;
          case "settings":
            renderSettingsPage();
            break;
          default:
            goGuildPage("overview", route.guildId, false);
            return;
        }
      } catch (error) {
        qs("viewRoot").innerHTML = `
          <div class="authNotice routeView">
            <h3>Guild load failed</h3>
            <p>${escapeHtml(error.message || "Failed to load guild data.")}</p>
            <button class="primaryButton" onclick="Dashboard.goHome()">Return Home</button>
          </div>
        `;
      }
    }
  }

  function pushRoute(path, render = true) {
    window.history.pushState({}, "", path);
    if (render) {
      renderRoute();
    }
  }

  function goHome(render = true) {
    pushRoute("/", render);
  }

  function goGuildPage(page, guildId = state.selectedGuildId, render = true) {
    if (!guildId) return;
    pushRoute(`/guild/${guildId}/${page}`, render);
  }

  function loginWithDiscord() {
    window.location.href = "/auth/login";
  }

  async function logout() {
    await fetch("/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  function saveCurrentPage() {
    const route = getRoute();
    if (route.type !== "guild") return;

    if (route.page === "moderation") {
      saveGuildSettings("moderation");
      return;
    }

    if (route.page === "jail") {
      saveGuildSettings("jail");
      return;
    }
  }

  window.addEventListener("popstate", renderRoute);

  return {
    init: renderRoute,
    goHome,
    goGuildPage,
    loginWithDiscord,
    logout,
    saveCurrentPage,
    saveCommandRoles,
    clearCommandRoles,
  };
})();

window.Dashboard = Dashboard;
window.addEventListener("DOMContentLoaded", Dashboard.init);