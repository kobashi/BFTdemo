/**
 * UI Controller for BFT Educational Web Application
 * Handles events, controls, preset switching, matrix rendering, and log feeds.
 */

import { BFTEngine } from './bft-engine.js';
import { NetworkRenderer } from './network-renderer.js';
import { TheoryController } from './theory.js';

export class UIController {
  constructor() {
    this.engine = new BFTEngine(4, 0);
    const canvas = document.getElementById('networkCanvas');
    this.renderer = new NetworkRenderer(canvas, this.engine);
    this.theory = new TheoryController();

    this.isPlaying = false;
    this.playInterval = null;
    this.playSpeed = 1000;

    this.initNavigation();
    this.initControls();
    this.initPresets();
    this.initEngineListeners();

    // Initial render
    this.updateUI();
  }

  initNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = tab.getAttribute('data-tab');
        
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        document.getElementById(targetId)?.classList.add('active');

        if (targetId === 'tab-simulator') {
          setTimeout(() => this.renderer.resizeCanvas(), 50);
        }
      });
    });
  }

  initControls() {
    // Total Nodes Slider
    const nodeSlider = document.getElementById('sliderNodes');
    const nodeVal = document.getElementById('valNodes');
    nodeSlider?.addEventListener('input', (e) => {
      const n = parseInt(e.target.value, 10);
      if (nodeVal) nodeVal.textContent = n;
      this.engine.setTotalNodes(n);
      this.updateLeaderSelectOptions();
    });

    // Leader Select
    const leaderSelect = document.getElementById('selectLeader');
    leaderSelect?.addEventListener('change', (e) => {
      const id = parseInt(e.target.value, 10);
      this.engine.setLeaderId(id);
    });

    // Playback buttons
    document.getElementById('btnReset')?.addEventListener('click', () => {
      this.pause();
      this.engine.reset();
    });

    document.getElementById('btnStep')?.addEventListener('click', () => {
      this.pause();
      this.engine.stepNext();
    });

    document.getElementById('btnPlay')?.addEventListener('click', () => {
      this.togglePlay();
    });

    // Speed Slider
    const speedSlider = document.getElementById('sliderSpeed');
    speedSlider?.addEventListener('input', (e) => {
      this.playSpeed = 2150 - parseInt(e.target.value, 10); // inverted for speed
      if (this.isPlaying) {
        this.pause();
        this.play();
      }
    });
  }

  updateLeaderSelectOptions() {
    const leaderSelect = document.getElementById('selectLeader');
    if (!leaderSelect) return;
    
    let html = '';
    for (let i = 0; i < this.engine.totalNodes; i++) {
      const isSelected = (i === this.engine.leaderId) ? 'selected' : '';
      html += `<option value="${i}" ${isSelected}>Node ${i} ${i === 0 ? '(Default)' : ''}</option>`;
    }
    leaderSelect.innerHTML = html;
  }

  initPresets() {
    const presets = {
      presetStandard: { N: 4, leader: 0, behaviors: { 3: 'lie_split' } },
      presetBreakdown: { N: 4, leader: 0, behaviors: { 2: 'silent', 3: 'lie_split' } },
      presetTraitorLeader: { N: 4, leader: 0, behaviors: { 0: 'lie_split' } },
      presetSilentNode: { N: 4, leader: 0, behaviors: { 3: 'silent' } }
    };

    Object.keys(presets).forEach(id => {
      const btn = document.getElementById(id);
      btn?.addEventListener('click', () => {
        document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const p = presets[id];
        const sliderN = document.getElementById('sliderNodes');
        if (sliderN) sliderN.value = p.N;
        document.getElementById('valNodes').textContent = p.N;

        this.engine.setTotalNodes(p.N);
        this.engine.setLeaderId(p.leader);
        this.updateLeaderSelectOptions();

        // Apply behaviors
        for (let nodeId in p.behaviors) {
          this.engine.setNodeBehavior(parseInt(nodeId, 10), p.behaviors[nodeId]);
        }

        this.engine.reset();
      });
    });
  }

  initEngineListeners() {
    this.engine.subscribe(() => {
      this.updateUI();
    });
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    if (this.engine.currentPhase === 'COMPLETED' || this.engine.currentPhase === 'FAILED') {
      this.engine.reset();
    }

    this.isPlaying = true;
    const btnPlay = document.getElementById('btnPlay');
    if (btnPlay) btnPlay.innerHTML = '⏸';

    this.playInterval = setInterval(() => {
      if (this.engine.currentPhase === 'COMPLETED' || this.engine.currentPhase === 'FAILED') {
        this.pause();
      } else {
        this.engine.stepNext();
      }
    }, this.playSpeed);
  }

  pause() {
    this.isPlaying = false;
    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
    const btnPlay = document.getElementById('btnPlay');
    if (btnPlay) btnPlay.innerHTML = '▶';
  }

  updateUI() {
    this.updateStatusBanner();
    this.updatePhaseBadge();
    this.renderNodeConfigList();
    this.renderMatrixTable();
    this.renderLogs();
  }

  updateStatusBanner() {
    const banner = document.getElementById('statusBanner');
    if (!banner) return;

    const N = this.engine.totalNodes;
    const F = this.engine.currentFaultyCount;
    const maxF = this.engine.maxFaultyAllowed;
    const isSatisfied = this.engine.isFormulaSatisfied;

    if (isSatisfied) {
      banner.className = 'status-banner success';
      banner.innerHTML = `
        <div class="status-icon">🛡️</div>
        <div>
          <div class="status-title">Consensus Safe: N=${N}, F=${F}</div>
          <div>Condition N ≥ 3f + 1 holds (${N} ≥ ${3*F + 1}). Quorum (2f+1) = <b>${2*F + 1} votes</b>.</div>
        </div>
      `;
    } else {
      banner.className = 'status-banner danger';
      banner.innerHTML = `
        <div class="status-icon">⚠️</div>
        <div>
          <div class="status-title">Rule Violated: N=${N}, F=${F}</div>
          <div>N=${N} cannot tolerate F=${F} malicious nodes! Max allowed F for N=${N} is <b>${maxF}</b>.</div>
        </div>
      `;
    }
  }

  updatePhaseBadge() {
    const badge = document.getElementById('phaseBadge');
    if (!badge) return;

    const phase = this.engine.currentPhase;
    badge.className = `phase-badge ${phase.toLowerCase()}`;
    badge.textContent = `PHASE: ${phase}`;
  }

  renderNodeConfigList() {
    const container = document.getElementById('nodeConfigList');
    if (!container) return;

    let html = '';
    this.engine.nodes.forEach(node => {
      const isLeader = node.isLeader;
      const dotClass = isLeader ? 'leader' : (node.behavior !== 'honest' ? 'byzantine' : 'honest');

      html += `
        <div class="node-config-item">
          <div class="node-tag">
            <span class="node-dot ${dotClass}"></span>
            Node ${node.id} ${isLeader ? '(Leader)' : ''}
          </div>
          <select class="node-behavior-select" data-node="${node.id}">
            <option value="honest" ${node.behavior === 'honest' ? 'selected' : ''}>🟢 Honest</option>
            <option value="silent" ${node.behavior === 'silent' ? 'selected' : ''}>⚪ Silent / Crash</option>
            <option value="lie_split" ${node.behavior === 'lie_split' ? 'selected' : ''}>🔴 Lie / Split-Vote</option>
            <option value="corrupt" ${node.behavior === 'corrupt' ? 'selected' : ''}>💥 Corrupt Payload</option>
          </select>
        </div>
      `;
    });

    container.innerHTML = html;

    // Attach event handlers to selects
    container.querySelectorAll('.node-behavior-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nodeId = parseInt(sel.getAttribute('data-node'), 10);
        const behavior = e.target.value;
        this.engine.setNodeBehavior(nodeId, behavior);
      });
    });
  }

  renderMatrixTable() {
    const tbody = document.getElementById('matrixTableBody');
    if (!tbody) return;

    let html = '';
    const qThreshold = this.engine.quorumThreshold;

    this.engine.nodes.forEach(node => {
      const isPre = node.preprepareReceived ? '✅ Accepted' : '⏳ Waiting';
      const preClass = node.preprepareReceived ? 'reached' : 'pending';

      const prepStatus = node.isPrepared ? `✅ (${qThreshold}/${qThreshold})` : `⏳ (${node.behavior === 'silent' ? 0 : 1}/${qThreshold})`;
      const prepClass = node.isPrepared ? 'reached' : 'pending';

      const commStatus = node.isCommitted ? `✅ (${qThreshold}/${qThreshold})` : `⏳ (${node.isPrepared ? 1 : 0}/${qThreshold})`;
      const commClass = node.isCommitted ? 'reached' : 'pending';

      const replyStatus = node.replied ? '✅ Sent' : '⏳ Pending';
      const replyClass = node.replied ? 'reached' : 'pending';

      html += `
        <tr>
          <td style="font-weight:600; font-family:var(--font-code);">
            Node ${node.id} ${node.isLeader ? '★' : ''}
          </td>
          <td><span class="quorum-pill ${preClass}">${isPre}</span></td>
          <td><span class="quorum-pill ${prepClass}">${prepStatus}</span></td>
          <td><span class="quorum-pill ${commClass}">${commStatus}</span></td>
          <td><span class="quorum-pill ${replyClass}">${replyStatus}</span></td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  renderLogs() {
    const logContainer = document.getElementById('logContainer');
    if (!logContainer) return;

    let html = '';
    this.engine.logs.forEach(log => {
      html += `
        <div class="log-entry">
          <span class="log-time">${log.time}</span>
          <span class="log-type ${log.type}">${log.type.toUpperCase()}</span>
          <span class="log-msg">${log.message}</span>
        </div>
      `;
    });

    logContainer.innerHTML = html;
  }
}

// Bootstrap app on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new UIController();
});
