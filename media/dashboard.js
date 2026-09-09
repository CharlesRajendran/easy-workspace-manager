/* eslint-env browser */
(function initDashboard() {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  // State
  let repos = [];
  let presets = [];
  let selectedPreset = null;
  let activeTab = 'runner';
  let userValues = {};
  let repoSelection = {};
  let highlightedIndex = -1;
  let filteredPresets = [];

  // Builder state
  let builderOptions = [];
  let builderOverrides = {};
  let builderTargets = {};

  // DOM Elements
  const tabRunnerBtn = document.getElementById('tab-runner-btn');
  const tabBuilderBtn = document.getElementById('tab-builder-btn');
  const tabRunner = document.getElementById('tab-runner');
  const tabBuilder = document.getElementById('tab-builder');

  const workspaceBadge = document.getElementById('workspace-badge');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnStopTerminals = document.getElementById('btn-stop-terminals');

  // Runner DOM
  const comboboxInput = document.getElementById('combobox-input');
  const comboboxList = document.getElementById('combobox-list');
  const comboboxToggle = document.getElementById('combobox-toggle');
  const comboboxClear = document.getElementById('combobox-clear');
  const btnSwitchToBuilder = document.getElementById('btn-switch-to-builder');

  const promptsCard = document.getElementById('prompts-card');
  const promptsContainer = document.getElementById('prompts-container');

  const repoList = document.getElementById('repo-list');
  const selectedCountBadge = document.getElementById('selected-count-badge');
  const btnSelectAll = document.getElementById('btn-select-all');
  const btnDeselectAll = document.getElementById('btn-deselect-all');

  const codePreview = document.getElementById('code-preview');
  const previewModeTag = document.getElementById('preview-mode-tag');
  const runnerModeSelect = document.getElementById('runner-mode-select');
  const btnRunCommand = document.getElementById('btn-run-command');
  const btnRunLabel = document.getElementById('btn-run-label');

  // Builder DOM
  const builderName = document.getElementById('builder-name');
  const builderDesc = document.getElementById('builder-description');
  const builderBaseCmd = document.getElementById('builder-base-command');
  const builderPlaceholdersHint = document.getElementById('builder-placeholders-hint');
  const btnAddOption = document.getElementById('btn-add-option');
  const optionsBuilderContainer = document.getElementById('options-builder-container');
  const builderRepoList = document.getElementById('builder-repo-list');
  const builderModeSelect = document.getElementById('builder-mode-select');
  const btnSavePreset = document.getElementById('btn-save-preset');
  const btnTestRunBuilder = document.getElementById('btn-test-run-builder');
  const btnResetBuilder = document.getElementById('btn-reset-builder');

  const toast = document.getElementById('toast');

  // Extract template placeholders like {branch} or {tag} using /[a-zA-Z0-9_:.-]+/
  function extractPlaceholders(command) {
    if (!command) return [];
    const matches = command.match(/(?<!\$)\{([a-zA-Z0-9_:.-]+)\}/g);
    if (!matches) return [];
    return Array.from(new Set(matches.map((m) => m.slice(1, -1))));
  }

  function getPresetTemplateVars(preset) {
    if (!preset) return [];
    const vars = new Set(extractPlaceholders(preset.baseCommand || ''));
    if (preset.repoOverrides) {
      Object.values(preset.repoOverrides).forEach((cmd) => {
        extractPlaceholders(cmd).forEach((v) => vars.add(v));
      });
    }
    return Array.from(vars);
  }

  function formatVarLabel(varName) {
    return varName
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function getVarPlaceholderExample(varName) {
    const lower = varName.toLowerCase();
    if (lower.includes('branch')) return 'e.g. main, develop, feature/...';
    if (lower.includes('tag')) return 'e.g. v1.0.0, latest';
    if (lower.includes('env')) return 'e.g. staging, production';
    if (lower.includes('msg') || lower.includes('message')) return 'e.g. feat: add new feature';
    if (lower.includes('version')) return 'e.g. 1.0.0';
    if (lower.includes('port')) return 'e.g. 3000, 8080';
    return `Enter value for {${varName}}...`;
  }

  function updateBuilderPlaceholdersHint() {
    if (!builderPlaceholdersHint) return;
    const placeholders = extractPlaceholders(builderBaseCmd ? builderBaseCmd.value : '');
    if (placeholders.length === 0) {
      builderPlaceholdersHint.style.display = 'none';
      builderPlaceholdersHint.innerHTML = '';
      return;
    }
    builderPlaceholdersHint.style.display = 'flex';
    builderPlaceholdersHint.innerHTML = `
      <span class="hint-label">Detected dynamic template variable${placeholders.length === 1 ? '' : 's'}:</span>
      ${placeholders.map((p) => `<span class="flag-badge variable-badge font-mono">{${escapeHtml(p)}}</span>`).join(' ')}
    `;
  }

  // Toast Helper
  function showToast(message, isError = false) {
    if (!toast) return;
    toast.textContent = message;
    toast.style.display = 'block';
    toast.style.borderLeftColor = isError ? '#f14c4c' : 'var(--primary-accent)';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3500);
  }

  // Tab Switching
  function switchTab(tab) {
    activeTab = tab;
    if (tab === 'runner') {
      tabRunnerBtn.classList.add('active');
      tabBuilderBtn.classList.remove('active');
      tabRunner.classList.add('active');
      tabBuilder.classList.remove('active');
      updateLivePreview();
    } else {
      tabRunnerBtn.classList.remove('active');
      tabBuilderBtn.classList.add('active');
      tabRunner.classList.remove('active');
      tabBuilder.classList.add('active');
      renderBuilderRepoList();
    }
  }

  tabRunnerBtn.addEventListener('click', () => switchTab('runner'));
  tabBuilderBtn.addEventListener('click', () => switchTab('builder'));
  btnSwitchToBuilder.addEventListener('click', () => switchTab('builder'));

  // Header Actions
  btnRefresh.addEventListener('click', () => {
    vscode.postMessage({ type: 'refresh' });
  });

  btnStopTerminals.addEventListener('click', () => {
    vscode.postMessage({
      type: 'showNotice',
      payload: { message: 'Closing managed terminals...', type: 'info' },
    });
    // Triggers VS Code command via extension
    window.postMessage({ type: 'stopTerminals' }, '*');
  });

  // COMBOBOX CONTROLLER
  function openCombobox() {
    filterCombobox(comboboxInput.value);
    comboboxList.style.display = 'block';
  }

  function closeCombobox() {
    comboboxList.style.display = 'none';
    highlightedIndex = -1;
  }

  function filterCombobox(query = '') {
    const q = query.toLowerCase().trim();
    if (!q) {
      filteredPresets = [...presets];
    } else {
      filteredPresets = presets.filter(
        (p) => p.name.toLowerCase().includes(q) || p.baseCommand.toLowerCase().includes(q),
      );
    }
    renderComboboxList();
  }

  function renderComboboxList() {
    comboboxList.innerHTML = '';
    if (filteredPresets.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'combobox-item';
      emptyLi.innerHTML = '<span class="empty-state">No matching commands found.</span>';
      comboboxList.appendChild(emptyLi);
      return;
    }

    filteredPresets.forEach((p, idx) => {
      const li = document.createElement('li');
      li.className = 'combobox-item';
      if (idx === highlightedIndex) {
        li.classList.add('highlighted');
      }

      li.innerHTML = `
        <div class="combobox-item-info">
          <span class="combobox-item-name">${escapeHtml(p.name)}</span>
          <span class="combobox-item-command">${escapeHtml(p.baseCommand)}</span>
        </div>
        <div class="combobox-item-actions">
          <button class="btn btn-icon btn-xs edit-preset-btn" title="Edit in Builder" data-id="${p.id}">
            ✏️
          </button>
          <button class="btn btn-icon btn-xs delete-preset-btn" title="Delete Preset" data-id="${p.id}">
            🗑️
          </button>
        </div>
      `;

      li.addEventListener('mousedown', (e) => {
        // If clicking action buttons, do not select
        if (e.target.closest('.combobox-item-actions')) return;
        selectPreset(p);
      });

      const editBtn = li.querySelector('.edit-preset-btn');
      editBtn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        editPresetInBuilder(p);
      });

      const delBtn = li.querySelector('.delete-preset-btn');
      delBtn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        deletePreset(p.id);
      });

      comboboxList.appendChild(li);
    });
  }

  function selectPreset(preset) {
    selectedPreset = preset;
    comboboxInput.value = preset.name;
    comboboxClear.style.display = 'block';
    closeCombobox();

    // Reset user values & repopulate with defaults
    userValues = {};
    if (preset.options) {
      preset.options.forEach((opt) => {
        const isSelf = Boolean(opt.isStandalone || opt.isSelfOption);
        if (isSelf) {
          const isDef = opt.defaultValue === 'true' || opt.defaultValue === true || opt.defaultValue === '1';
          userValues[opt.id] = isDef ? 'true' : 'false';
        } else {
          userValues[opt.id] = opt.defaultValue || '';
        }
      });
    }

    // Populate template variables defaults
    const templateVars = getPresetTemplateVars(preset);
    templateVars.forEach((varName) => {
      if (userValues[varName] === undefined) {
        if (varName.toLowerCase() === 'branch') {
          const activeRepoWithBranch = repos.find((r) => r.gitBranch && repoSelection[r.id] !== false)
            || repos.find((r) => r.gitBranch);
          userValues[varName] = activeRepoWithBranch ? activeRepoWithBranch.gitBranch : 'main';
        } else {
          userValues[varName] = '';
        }
      }
    });

    // Update execution mode
    if (preset.executionMode) {
      runnerModeSelect.value = preset.executionMode;
    }

    // Update repo targets if specified
    if (preset.targetRepoIds && preset.targetRepoIds.length > 0) {
      repos.forEach((r) => {
        repoSelection[r.id] = preset.targetRepoIds.includes(r.id);
      });
    } else {
      repos.forEach((r) => {
        repoSelection[r.id] = true;
      });
    }

    renderPrompts();
    renderRepoList();
    updateLivePreview();
  }

  function editPresetInBuilder(preset) {
    builderName.value = preset.name;
    builderDesc.value = preset.description || '';
    builderBaseCmd.value = preset.baseCommand;
    builderModeSelect.value = preset.executionMode || 'parallel';
    builderOptions = (preset.options || []).map((opt) => ({ ...opt }));
    builderOverrides = { ...(preset.repoOverrides || {}) };

    builderTargets = {};
    repos.forEach((r) => {
      builderTargets[r.id] = !preset.targetRepoIds || preset.targetRepoIds.includes(r.id);
    });

    renderBuilderOptions();
    renderBuilderRepoList();
    updateBuilderPlaceholdersHint();
    switchTab('builder');
  }

  function deletePreset(id) {
    vscode.postMessage({ type: 'deletePreset', payload: { id } });
  }

  // Combobox Events
  comboboxInput.addEventListener('focus', () => openCombobox());
  comboboxInput.addEventListener('input', (e) => {
    comboboxClear.style.display = comboboxInput.value ? 'block' : 'none';
    openCombobox();
  });

  comboboxClear.addEventListener('click', () => {
    comboboxInput.value = '';
    comboboxClear.style.display = 'none';
    selectedPreset = null;
    promptsCard.style.display = 'none';
    updateLivePreview();
    openCombobox();
  });

  comboboxToggle.addEventListener('click', (e) => {
    e.preventDefault();
    if (comboboxList.style.display === 'block') {
      closeCombobox();
    } else {
      comboboxInput.focus();
      openCombobox();
    }
  });

  document.addEventListener('click', (e) => {
    if (!document.getElementById('combobox-wrapper').contains(e.target)) {
      closeCombobox();
    }
  });

  comboboxInput.addEventListener('keydown', (e) => {
    if (comboboxList.style.display !== 'block') {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        openCombobox();
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightedIndex = Math.min(highlightedIndex + 1, filteredPresets.length - 1);
      renderComboboxList();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightedIndex = Math.max(highlightedIndex - 1, 0);
      renderComboboxList();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredPresets.length) {
        selectPreset(filteredPresets[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      closeCombobox();
    }
  });

  // RENDER DYNAMIC PROMPTS & TEMPLATE VARIABLES
  function renderPrompts() {
    if (!selectedPreset) {
      promptsCard.style.display = 'none';
      promptsContainer.innerHTML = '';
      return;
    }

    const templateVars = getPresetTemplateVars(selectedPreset);
    const options = selectedPreset.options || [];

    if (templateVars.length === 0 && options.length === 0) {
      promptsCard.style.display = 'none';
      promptsContainer.innerHTML = '';
      return;
    }

    promptsCard.style.display = 'block';
    promptsContainer.innerHTML = '';

    // 1. Render Template Placeholders (e.g. {branch})
    templateVars.forEach((varName) => {
      const field = document.createElement('div');
      field.className = 'prompt-field';

      const label = document.createElement('label');
      label.innerHTML = `
        <span>${escapeHtml(formatVarLabel(varName))}</span>
        <span class="flag-badge variable-badge font-mono">{${escapeHtml(varName)}}</span>
        <span class="required">*</span>
      `;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-input prompt-template-input';
      input.dataset.var = varName;
      input.placeholder = getVarPlaceholderExample(varName);
      input.value = userValues[varName] !== undefined ? userValues[varName] : '';

      input.addEventListener('input', (e) => {
        userValues[varName] = e.target.value;
        updateLivePreview();
      });

      field.appendChild(label);
      field.appendChild(input);
      promptsContainer.appendChild(field);
    });

    // 2. Render Options / Flags (e.g. -m or --tags)
    options.forEach((opt) => {
      const isSelf = Boolean(opt.isStandalone || opt.isSelfOption);
      const field = document.createElement('div');
      field.className = isSelf ? 'prompt-field prompt-field-checkbox' : 'prompt-field';

      if (isSelf) {
        const isChecked = userValues[opt.id] === 'true' || userValues[opt.id] === true
          || (userValues[opt.id] === undefined && (opt.defaultValue === 'true' || opt.defaultValue === true));
        userValues[opt.id] = isChecked ? 'true' : 'false';

        field.innerHTML = `
          <label class="prompt-checkbox-label" title="${escapeHtml(opt.placeholder || opt.flag || 'Toggle flag')}">
            <input type="checkbox" class="prompt-opt-checkbox" data-opt-id="${escapeHtml(opt.id)}" ${isChecked ? 'checked' : ''} />
            <div class="prompt-checkbox-content">
              <span class="prompt-checkbox-title">${escapeHtml(opt.placeholder || opt.flag || 'Self Option')}</span>
              ${opt.flag ? `<span class="flag-badge font-mono">${escapeHtml(opt.flag)}</span>` : ''}
              <span class="self-option-tag">self-option</span>
            </div>
          </label>
        `;

        field.querySelector('.prompt-opt-checkbox').addEventListener('change', (e) => {
          userValues[opt.id] = e.target.checked ? 'true' : 'false';
          updateLivePreview();
        });
      } else {
        const label = document.createElement('label');
        label.innerHTML = `
          <span>${escapeHtml(opt.placeholder || 'Option Value')}</span>
          ${opt.flag ? `<span class="flag-badge">${escapeHtml(opt.flag)}</span>` : ''}
          ${opt.required ? '<span class="required">*</span>' : ''}
        `;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-input prompt-opt-input';
        input.dataset.optId = opt.id;
        input.placeholder = opt.placeholder || 'Enter value...';
        input.value = userValues[opt.id] !== undefined ? userValues[opt.id] : (opt.defaultValue || '');

        input.addEventListener('input', (e) => {
          userValues[opt.id] = e.target.value;
          updateLivePreview();
        });

        field.appendChild(label);
        field.appendChild(input);
      }

      promptsContainer.appendChild(field);
    });
  }

  // RENDER REPOSITORIES LIST
  function renderRepoList() {
    repoList.innerHTML = '';

    if (repos.length === 0) {
      repoList.innerHTML = '<div class="empty-state">No repositories detected in active workspace.</div>';
      selectedCountBadge.textContent = '0 Projects';
      return;
    }

    let selectedCount = 0;

    repos.forEach((repo) => {
      const isSelected = repoSelection[repo.id] !== false;
      if (isSelected) selectedCount += 1;

      const overrideCmd = selectedPreset?.repoOverrides?.[repo.id];

      const card = document.createElement('div');
      card.className = `repo-card ${isSelected ? '' : 'unselected'}`;

      const scriptsHtml = (repo.scripts || [])
        .slice(0, 5)
        .map((s) => `<span class="script-chip" title="Click to use as override: npm run ${s}" data-script="${s}">${s}</span>`)
        .join('');

      card.innerHTML = `
        <div class="repo-card-left">
          <input type="checkbox" class="repo-checkbox" ${isSelected ? 'checked' : ''} />
          <div class="repo-details">
            <div class="repo-title-row">
              <span class="repo-name">${escapeHtml(repo.name)}</span>
              ${repo.isGitRepo && repo.gitBranch ? `<span class="branch-badge"> ${escapeHtml(repo.gitBranch)}</span>` : ''}
            </div>
            ${overrideCmd ? `<div class="repo-override-badge">Override: ${escapeHtml(overrideCmd)}</div>` : ''}
            ${scriptsHtml ? `<div class="scripts-row">${scriptsHtml}</div>` : ''}
          </div>
        </div>
        <div class="repo-card-right">
          <button class="btn btn-icon btn-xs launch-term-btn" title="Open terminal for ${escapeHtml(repo.name)}">
            <svg class="icon" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h11A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11zm3.854 4.146a.5.5 0 0 0-.708.708l2 2a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0-.708-.708L7 7.793 4.854 6.646zM8 10.5a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1H8z"/></svg>
          </button>
        </div>
      `;

      // Checkbox event
      const checkbox = card.querySelector('.repo-checkbox');
      checkbox.addEventListener('change', () => {
        repoSelection[repo.id] = checkbox.checked;
        if (checkbox.checked) {
          card.classList.remove('unselected');
        } else {
          card.classList.add('unselected');
        }
        updateSelectedCount();
        updateLivePreview();
      });

      // Terminal launch button
      const termBtn = card.querySelector('.launch-term-btn');
      termBtn.addEventListener('click', () => {
        vscode.postMessage({
          type: 'openTerminal',
          payload: { repoPath: repo.path, repoName: repo.name },
        });
      });

      // Script chips click
      card.querySelectorAll('.script-chip').forEach((chip) => {
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          const scriptName = chip.getAttribute('data-script');
          showToast(`Selected script: npm run ${scriptName} for ${repo.name}`);
        });
      });

      repoList.appendChild(card);
    });

    updateSelectedCount();
  }

  function updateSelectedCount() {
    const total = repos.length;
    const selected = repos.filter((r) => repoSelection[r.id] !== false).length;
    selectedCountBadge.textContent = `${selected} / ${total} Selected`;
    btnRunLabel.textContent = `Run Across ${selected} Repositor${selected === 1 ? 'y' : 'ies'}`;
    btnRunCommand.disabled = selected === 0;
  }

  btnSelectAll.addEventListener('click', () => {
    repos.forEach((r) => { repoSelection[r.id] = true; });
    renderRepoList();
    updateLivePreview();
  });

  btnDeselectAll.addEventListener('click', () => {
    repos.forEach((r) => { repoSelection[r.id] = false; });
    renderRepoList();
    updateLivePreview();
  });

  // ASSEMBLED COMMAND LOGIC & LIVE PREVIEW
  function assembleSingleCommand(baseCommand, options, values, isLivePreview = false, repoContext = null) {
    let result = (baseCommand || '').trim();

    const isSelfOption = (opt) => Boolean(opt.isStandalone || opt.isSelfOption);
    const isValueTruthy = (val) => val === true || val === 'true' || val === '1' || val === 'yes' || val === 'on';

    // Replace template tags {name}
    Object.entries(values || {}).forEach(([key, rawVal]) => {
      const matchedOpt = (options || []).find((o) => o.id === key);
      if (matchedOpt && isSelfOption(matchedOpt)) {
        const flagVal = isValueTruthy(rawVal) ? (matchedOpt.flag || '') : '';
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const reg = new RegExp(`\\{${escapedKey}\\}`, 'g');
        result = result.replace(reg, () => flagVal);
        return;
      }

      const val = rawVal !== undefined && rawVal !== null ? String(rawVal) : '';
      if (isLivePreview && !val.trim()) {
        // Keep {key} in live preview if not provided yet so user sees placeholder
        return;
      }
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(`\\{${escapedKey}\\}`, 'g');
      result = result.replace(reg, () => val);
    });

    // Contextual fallback tokens if provided and not explicitly overridden in values
    if (repoContext) {
      if (repoContext.name && !values?.repo && !values?.repoName) {
        result = result.replace(/\{repo\}/g, () => repoContext.name);
        result = result.replace(/\{repoName\}/g, () => repoContext.name);
      }
      if (repoContext.path && !values?.repoPath) {
        result = result.replace(/\{repoPath\}/g, () => repoContext.path);
      }
      if (repoContext.gitBranch && !values?.gitBranch && !values?.branch) {
        result = result.replace(/\{gitBranch\}/g, () => repoContext.gitBranch);
      }
    }

    // Append defined options
    (options || []).forEach((opt) => {
      const isSelf = isSelfOption(opt);
      const rawVal = values ? values[opt.id] : undefined;
      const effectiveVal = rawVal !== undefined ? rawVal : (opt.defaultValue || '');

      if (isSelf) {
        if (!isValueTruthy(effectiveVal)) return;

        const flagToAppend = (opt.flag || opt.placeholder || '').trim();
        if (!flagToAppend) return;

        if (result.includes(`{${opt.id}}`) || result.includes(flagToAppend)) {
          return;
        }

        result = `${result} ${flagToAppend}`;
        return;
      }

      const val = (String(effectiveVal)).trim();
      if (!val) return;

      if (result.includes(`{${opt.id}}`) || (opt.flag && result.includes(opt.flag))) {
        return;
      }

      const escaped = val.replace(/"/g, '\\"');
      const formatted = val.includes(' ') || val.includes('\n') ? `"${escaped}"` : val;

      if (opt.flag) {
        result = `${result} ${opt.flag} ${formatted}`;
      } else {
        result = `${result} ${formatted}`;
      }
    });

    return result.replace(/\s+/g, ' ').trim();
  }

  function updateLivePreview() {
    if (!selectedPreset) {
      codePreview.innerHTML = '<code>Select or search for a command above to see execution preview.</code>';
      return;
    }

    const selectedRepos = repos.filter((r) => repoSelection[r.id] !== false);
    if (selectedRepos.length === 0) {
      codePreview.innerHTML = '<code>No repositories selected. Check at least one repository above.</code>';
      return;
    }

    const baseCmd = selectedPreset.baseCommand;

    const lines = selectedRepos.map((r) => {
      const override = selectedPreset.repoOverrides?.[r.id];
      const cmdToAssemble = override || baseCmd;
      const finalCmd = assembleSingleCommand(cmdToAssemble, selectedPreset.options, userValues, true, r);
      return `<span style="color:#858585;"># In ${escapeHtml(r.name)} (${escapeHtml(r.path)})</span>\n$ ${escapeHtml(finalCmd)}`;
    });

    codePreview.innerHTML = `<code>${lines.join('\n\n')}</code>`;
    previewModeTag.textContent = `${runnerModeSelect.value === 'parallel' ? 'Parallel' : 'Sequential'} Execution`;
  }

  runnerModeSelect.addEventListener('change', () => {
    updateLivePreview();
  });

  // EXECUTE COMMAND
  btnRunCommand.addEventListener('click', () => {
    if (!selectedPreset) {
      showToast('Please select a command preset first.', true);
      return;
    }

    const selectedRepos = repos.filter((r) => repoSelection[r.id] !== false);
    if (selectedRepos.length === 0) {
      showToast('Please select at least one target repository.', true);
      return;
    }

    // Check required template variables
    const templateVars = getPresetTemplateVars(selectedPreset);
    for (const varName of templateVars) {
      if (!userValues[varName] || !userValues[varName].trim()) {
        showToast(`Template variable "{${varName}}" is required.`, true);
        const input = promptsContainer.querySelector(`[data-var="${varName}"]`);
        if (input) input.focus();
        return;
      }
    }

    // Check required options
    if (selectedPreset.options) {
      for (const opt of selectedPreset.options) {
        const isSelf = Boolean(opt.isStandalone || opt.isSelfOption);
        if (!isSelf && opt.required && !userValues[opt.id]?.trim()) {
          showToast(`Option "${opt.placeholder || opt.flag}" is required.`, true);
          const input = promptsContainer.querySelector(`[data-opt-id="${opt.id}"]`);
          if (input) input.focus();
          return;
        }
      }
    }

    const baseCmd = selectedPreset.baseCommand;
    const assembledDefault = assembleSingleCommand(baseCmd, selectedPreset.options, userValues, false);

    const targets = selectedRepos.map((r) => {
      const override = selectedPreset.repoOverrides?.[r.id];
      const cmdToAssemble = override || baseCmd;
      const finalCmd = assembleSingleCommand(cmdToAssemble, selectedPreset.options, userValues, false, r);
      return {
        repoId: r.id,
        repoPath: r.path,
        repoName: r.name,
        command: finalCmd,
      };
    });

    vscode.postMessage({
      type: 'runCommand',
      payload: {
        presetId: selectedPreset.id,
        presetName: selectedPreset.name,
        baseCommand: selectedPreset.baseCommand,
        assembledCommand: assembledDefault,
        targets,
        mode: runnerModeSelect.value,
      },
    });
  });

  // BUILDER LOGIC
  function renderBuilderOptions() {
    optionsBuilderContainer.innerHTML = '';
    const hint = document.getElementById('empty-options-hint');

    if (builderOptions.length === 0) {
      optionsBuilderContainer.innerHTML = '<div class="empty-options">No custom options added yet. Click "+ Add Option / Flag" above.</div>';
      return;
    }

    builderOptions.forEach((opt, idx) => {
      const isSelf = Boolean(opt.isStandalone || opt.isSelfOption);
      const isDefaultOn = opt.defaultValue === 'true' || opt.defaultValue === true;
      const row = document.createElement('div');
      row.className = 'option-builder-row';

      row.innerHTML = `
        <input type="text" class="form-input option-flag-input font-mono" placeholder="Flag (${isSelf ? 'e.g. -f, --tags' : 'e.g. -m'})" value="${escapeHtml(opt.flag || '')}" title="Command flag syntax (e.g. -f, --tags, -m)" />
        <input type="text" class="form-input option-label-input" placeholder="${isSelf ? 'Description (e.g. Force push / Include tags)' : 'Placeholder (e.g. Enter message)'}" value="${escapeHtml(opt.placeholder || '')}" title="Label or prompt placeholder" />
        <label class="option-toggle-label ${isSelf ? 'active' : ''}" title="Toggle between Key-Value argument (expects value input) and Self Option (standalone flag like -f or --tags without value)">
          <input type="checkbox" class="option-standalone-check" ${isSelf ? 'checked' : ''} />
          <span class="option-type-badge ${isSelf ? 'self' : ''}">${isSelf ? 'Self Option' : 'Key-Value'}</span>
        </label>
        ${
          isSelf
            ? `
          <label class="option-toggle-label ${isDefaultOn ? 'active' : ''}" title="Whether this flag is enabled by default before execution" style="font-size: 11px;">
            <input type="checkbox" class="option-default-bool-check" ${isDefaultOn ? 'checked' : ''} /> Default On
          </label>
        `
            : `
          <input type="text" class="form-input option-default-input" placeholder="Default (optional)" value="${escapeHtml(opt.defaultValue || '')}" title="Default value if not supplied by user" />
          <label class="option-toggle-label" title="User must provide a value before execution" style="font-size: 11px;">
            <input type="checkbox" class="option-required-check" ${opt.required ? 'checked' : ''} /> Req
          </label>
        `
        }
        <button type="button" class="btn btn-icon btn-xs remove-option-btn" title="Remove Option">✕</button>
      `;

      row.querySelector('.option-flag-input').addEventListener('input', (e) => {
        builderOptions[idx].flag = e.target.value;
      });
      row.querySelector('.option-label-input').addEventListener('input', (e) => {
        builderOptions[idx].placeholder = e.target.value;
      });

      row.querySelector('.option-standalone-check').addEventListener('change', (e) => {
        builderOptions[idx].isStandalone = e.target.checked;
        builderOptions[idx].isSelfOption = e.target.checked;
        if (e.target.checked) {
          builderOptions[idx].required = false;
          builderOptions[idx].defaultValue = builderOptions[idx].defaultValue === 'true' ? 'true' : 'false';
        } else {
          builderOptions[idx].defaultValue = '';
        }
        renderBuilderOptions();
      });

      if (isSelf) {
        const defaultBoolCheck = row.querySelector('.option-default-bool-check');
        if (defaultBoolCheck) {
          defaultBoolCheck.addEventListener('change', (e) => {
            builderOptions[idx].defaultValue = e.target.checked ? 'true' : 'false';
            renderBuilderOptions();
          });
        }
      } else {
        const defaultInput = row.querySelector('.option-default-input');
        if (defaultInput) {
          defaultInput.addEventListener('input', (e) => {
            builderOptions[idx].defaultValue = e.target.value;
          });
        }
        const reqCheck = row.querySelector('.option-required-check');
        if (reqCheck) {
          reqCheck.addEventListener('change', (e) => {
            builderOptions[idx].required = e.target.checked;
          });
        }
      }

      row.querySelector('.remove-option-btn').addEventListener('click', () => {
        builderOptions.splice(idx, 1);
        renderBuilderOptions();
      });

      optionsBuilderContainer.appendChild(row);
    });
  }

  btnAddOption.addEventListener('click', () => {
    builderOptions.push({
      id: `opt-${Date.now()}`,
      flag: '',
      placeholder: '',
      defaultValue: '',
      required: false,
      isStandalone: false,
      isSelfOption: false,
    });
    renderBuilderOptions();
  });

  function renderBuilderRepoList() {
    builderRepoList.innerHTML = '';
    if (repos.length === 0) {
      builderRepoList.innerHTML = '<div class="empty-state">No repositories detected in active workspace.</div>';
      return;
    }

    repos.forEach((repo) => {
      const isTargeted = builderTargets[repo.id] !== false;
      const currentOverride = builderOverrides[repo.id] || '';

      const row = document.createElement('div');
      row.className = 'builder-repo-row';

      row.innerHTML = `
        <input type="checkbox" class="builder-repo-check" ${isTargeted ? 'checked' : ''} />
        <div style="width: 160px; font-weight: 500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          ${escapeHtml(repo.name)}
        </div>
        <input type="text" class="builder-repo-override-input" placeholder="Default command override for ${escapeHtml(repo.name)} (optional, e.g. ng serve)" value="${escapeHtml(currentOverride)}" />
      `;

      row.querySelector('.builder-repo-check').addEventListener('change', (e) => {
        builderTargets[repo.id] = e.target.checked;
      });

      row.querySelector('.builder-repo-override-input').addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (val) {
          builderOverrides[repo.id] = val;
        } else {
          delete builderOverrides[repo.id];
        }
      });

      builderRepoList.appendChild(row);
    });
  }

  builderBaseCmd.addEventListener('input', updateBuilderPlaceholdersHint);

  btnResetBuilder.addEventListener('click', () => {
    builderName.value = '';
    builderDesc.value = '';
    builderBaseCmd.value = '';
    builderOptions = [];
    builderOverrides = {};
    builderTargets = {};
    renderBuilderOptions();
    renderBuilderRepoList();
    updateBuilderPlaceholdersHint();
  });

  btnSavePreset.addEventListener('click', () => {
    const name = builderName.value.trim();
    const baseCmd = builderBaseCmd.value.trim();

    if (!name) {
      showToast('Please enter a Command Name.', true);
      builderName.focus();
      return;
    }
    if (!baseCmd) {
      showToast('Please enter a Base Shell Command.', true);
      builderBaseCmd.focus();
      return;
    }

    const targetedRepoIds = repos.filter((r) => builderTargets[r.id] !== false).map((r) => r.id);

    const presetPayload = {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name,
      description: builderDesc.value.trim(),
      baseCommand: baseCmd,
      options: builderOptions,
      targetRepoIds: targetedRepoIds,
      repoOverrides: builderOverrides,
      executionMode: builderModeSelect.value,
    };

    vscode.postMessage({
      type: 'savePreset',
      payload: presetPayload,
    });
  });

  btnTestRunBuilder.addEventListener('click', () => {
    const baseCmd = builderBaseCmd.value.trim();
    if (!baseCmd) {
      showToast('Please enter a Base Shell Command first.', true);
      return;
    }

    const placeholders = extractPlaceholders(baseCmd);
    if (placeholders.length > 0) {
      showToast(`Command contains dynamic variable${placeholders.length === 1 ? '' : 's'} {${placeholders.join(', ')}}. Save as preset to enter values and run.`, true);
      return;
    }

    const targetedRepos = repos.filter((r) => builderTargets[r.id] !== false);
    if (targetedRepos.length === 0) {
      showToast('Please select at least one repository.', true);
      return;
    }

    const targets = targetedRepos.map((r) => ({
      repoId: r.id,
      repoPath: r.path,
      repoName: r.name,
      command: builderOverrides[r.id] || baseCmd,
    }));

    vscode.postMessage({
      type: 'runCommand',
      payload: {
        presetName: builderName.value.trim() || 'Ad-Hoc Run',
        baseCommand: baseCmd,
        assembledCommand: baseCmd,
        targets,
        mode: builderModeSelect.value,
      },
    });
  });

  // MESSAGES FROM EXTENSION
  window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.type) {
      case 'stateUpdate': {
        const { payload } = message;
        repos = payload.repos || [];
        presets = payload.presets || [];

        // Update badge
        workspaceBadge.textContent = `${repos.length} Project${repos.length === 1 ? '' : 's'} Active`;

        // Update selection defaults if needed
        repos.forEach((r) => {
          if (repoSelection[r.id] === undefined) {
            repoSelection[r.id] = true;
          }
        });

        // If active tab specified
        if (payload.activeTab) {
          switchTab(payload.activeTab);
        }

        // Active preset
        if (payload.activePresetId) {
          const found = presets.find((p) => p.id === payload.activePresetId);
          if (found) {
            selectPreset(found);
          }
        } else if (!selectedPreset && presets.length > 0) {
          selectPreset(presets[0]);
        }

        renderComboboxList();
        renderRepoList();
        renderBuilderRepoList();
        updateLivePreview();
        break;
      }
      case 'executionSuccess': {
        showToast(`Dispatched to ${message.payload.count} terminals.`);
        break;
      }
      case 'executionError': {
        showToast(message.payload.message, true);
        break;
      }
      default:
        break;
    }
  });

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Signal ready to host
  vscode.postMessage({ type: 'ready' });
}());
