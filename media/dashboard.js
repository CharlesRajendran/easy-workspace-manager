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
  const btnAddOption = document.getElementById('btn-add-option');
  const optionsBuilderContainer = document.getElementById('options-builder-container');
  const builderRepoList = document.getElementById('builder-repo-list');
  const builderModeSelect = document.getElementById('builder-mode-select');
  const btnSavePreset = document.getElementById('btn-save-preset');
  const btnTestRunBuilder = document.getElementById('btn-test-run-builder');
  const btnResetBuilder = document.getElementById('btn-reset-builder');

  const toast = document.getElementById('toast');

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
        userValues[opt.id] = opt.defaultValue || '';
      });
    }

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

  // RENDER DYNAMIC PROMPTS
  function renderPrompts() {
    if (!selectedPreset || !selectedPreset.options || selectedPreset.options.length === 0) {
      promptsCard.style.display = 'none';
      promptsContainer.innerHTML = '';
      return;
    }

    promptsCard.style.display = 'block';
    promptsContainer.innerHTML = '';

    selectedPreset.options.forEach((opt) => {
      const field = document.createElement('div');
      field.className = 'prompt-field';

      const label = document.createElement('label');
      label.innerHTML = `
        <span>${escapeHtml(opt.placeholder || 'Option Value')}</span>
        ${opt.flag ? `<span class="flag-badge">${escapeHtml(opt.flag)}</span>` : ''}
        ${opt.required ? '<span class="required">*</span>' : ''}
      `;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-input';
      input.placeholder = opt.placeholder || 'Enter value...';
      input.value = userValues[opt.id] || '';

      input.addEventListener('input', (e) => {
        userValues[opt.id] = e.target.value;
        updateLivePreview();
      });

      field.appendChild(label);
      field.appendChild(input);
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
  function assembleSingleCommand(baseCommand, options, values) {
    let result = (baseCommand || '').trim();

    // Replace template tags {name}
    Object.entries(values).forEach(([key, val]) => {
      const reg = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(reg, val || '');
    });

    // Append defined options
    (options || []).forEach((opt) => {
      const val = (values[opt.id] || opt.defaultValue || '').trim();
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

    return result.trim();
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
    const assembledDefault = assembleSingleCommand(baseCmd, selectedPreset.options, userValues);

    const lines = selectedRepos.map((r) => {
      const override = selectedPreset.repoOverrides?.[r.id];
      const finalCmd = override ? assembleSingleCommand(override, selectedPreset.options, userValues) : assembledDefault;
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

    // Check required options
    if (selectedPreset.options) {
      for (const opt of selectedPreset.options) {
        if (opt.required && !userValues[opt.id]?.trim()) {
          showToast(`Option "${opt.placeholder || opt.flag}" is required.`, true);
          return;
        }
      }
    }

    const baseCmd = selectedPreset.baseCommand;
    const assembledDefault = assembleSingleCommand(baseCmd, selectedPreset.options, userValues);

    const targets = selectedRepos.map((r) => {
      const override = selectedPreset.repoOverrides?.[r.id];
      const finalCmd = override ? assembleSingleCommand(override, selectedPreset.options, userValues) : assembledDefault;
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
      const row = document.createElement('div');
      row.className = 'option-builder-row';

      row.innerHTML = `
        <input type="text" class="form-input option-flag-input" placeholder="Flag (e.g. -m)" value="${escapeHtml(opt.flag || '')}" />
        <input type="text" class="form-input option-label-input" placeholder="Placeholder (e.g. Enter message)" value="${escapeHtml(opt.placeholder || '')}" />
        <input type="text" class="form-input option-default-input" placeholder="Default (optional)" value="${escapeHtml(opt.defaultValue || '')}" />
        <label style="font-size: 11px; display:flex; align-items:center; gap:4px; cursor:pointer;">
          <input type="checkbox" class="option-required-check" ${opt.required ? 'checked' : ''} /> Req
        </label>
        <button type="button" class="btn btn-icon btn-xs remove-option-btn" title="Remove Option">✕</button>
      `;

      row.querySelector('.option-flag-input').addEventListener('input', (e) => {
        builderOptions[idx].flag = e.target.value;
      });
      row.querySelector('.option-label-input').addEventListener('input', (e) => {
        builderOptions[idx].placeholder = e.target.value;
      });
      row.querySelector('.option-default-input').addEventListener('input', (e) => {
        builderOptions[idx].defaultValue = e.target.value;
      });
      row.querySelector('.option-required-check').addEventListener('change', (e) => {
        builderOptions[idx].required = e.target.checked;
      });
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

  btnResetBuilder.addEventListener('click', () => {
    builderName.value = '';
    builderDesc.value = '';
    builderBaseCmd.value = '';
    builderOptions = [];
    builderOverrides = {};
    builderTargets = {};
    renderBuilderOptions();
    renderBuilderRepoList();
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
