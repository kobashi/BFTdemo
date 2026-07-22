/**
 * UI Controller for BFT Educational Web Application
 * Handles controls, preset switching, matrix rendering, log feeds,
 * explicit Traitor Vote Exclusion & Tally Inspector, and Node Details Inspector Modal.
 */

import { BFTEngine } from './bft-engine.js';
import { NetworkRenderer } from './network-renderer.js';
import { TheoryController } from './theory.js';

export class UIController {
  constructor() {
    // Default N=7 nodes
    this.engine = new BFTEngine(7, 0);
    const canvas = document.getElementById('networkCanvas');
    
    this.renderer = new NetworkRenderer(canvas, this.engine, (nodeId) => {
      this.showNodeModal(nodeId);
    });
    
    this.theory = new TheoryController();

    this.isPlaying = false;
    this.playInterval = null;
    this.playSpeed = 5150;
    this.activeModalNodeId = null;

    this.initNavigation();
    this.initControls();
    this.initPresets();
    this.initModalEvents();
    this.initEngineListeners();

    // Default N=7 setup: Node 5 = lie_split, Node 6 = corrupt to show both traitor and corrupt exclusion immediately!
    this.engine.setNodeBehavior(5, 'lie_split');
    this.engine.setNodeBehavior(6, 'corrupt');
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
    const nodeSlider = document.getElementById('sliderNodes');
    const nodeVal = document.getElementById('valNodes');
    nodeSlider?.addEventListener('input', (e) => {
      const n = parseInt(e.target.value, 10);
      if (nodeVal) nodeVal.textContent = n;
      this.engine.setTotalNodes(n);
      this.updateLeaderSelectOptions();
    });

    const leaderSelect = document.getElementById('selectLeader');
    leaderSelect?.addEventListener('change', (e) => {
      const id = parseInt(e.target.value, 10);
      this.engine.setLeaderId(id);
    });

    // Playback Buttons: Play/Pause Toggle, Stop & Reset, Step
    document.getElementById('btnPlayPause')?.addEventListener('click', () => {
      this.togglePlay();
    });

    document.getElementById('btnStop')?.addEventListener('click', () => {
      this.pause();
      this.renderer.setPaused(false);
      this.engine.reset(true);
    });

    document.getElementById('btnStep')?.addEventListener('click', () => {
      this.pause();
      this.engine.stepNext();
    });

    // Speed Slider Handler
    const speedSlider = document.getElementById('sliderSpeed');
    const syncSpeed = (sliderVal) => {
      const val = parseInt(sliderVal, 10);
      this.playSpeed = Math.round(8500 - (val - 1) * 67.67);
      const sec = (this.playSpeed / 1000).toFixed(1);
      const label = document.getElementById('valSpeedText');
      if (label) label.textContent = `${sec}秒/step`;
      this.renderer.setSpeed(this.playSpeed);
    };

    if (speedSlider) {
      syncSpeed(speedSlider.value);
      speedSlider.addEventListener('input', (e) => {
        syncSpeed(e.target.value);
        if (this.isPlaying) {
          this.pause();
          this.play();
        }
      });
    }
  }

  initModalEvents() {
    const overlay = document.getElementById('nodeModalOverlay');
    const btnClose = document.getElementById('btnNodeModalClose');

    const closeModal = () => {
      overlay?.classList.remove('open');
      this.activeModalNodeId = null;
    };

    btnClose?.addEventListener('click', closeModal);
    
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay?.classList.contains('open')) {
        closeModal();
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
      presetStandard7: { N: 7, leader: 0, behaviors: { 5: 'lie_split', 6: 'corrupt' } },
      presetBreakdown7: { N: 7, leader: 0, behaviors: { 4: 'silent', 5: 'lie_split', 6: 'corrupt' } },
      presetMultiCorrupt7: { N: 7, leader: 0, behaviors: { 5: 'corrupt', 6: 'corrupt' } },
      presetStandard4: { N: 4, leader: 0, behaviors: { 3: 'lie_split' } },
      presetTraitorLeader4: { N: 4, leader: 0, behaviors: { 0: 'lie_split' } },
      presetCorrupt4: { N: 4, leader: 0, behaviors: { 3: 'corrupt' } }
    };

    Object.keys(presets).forEach(id => {
      const btn = document.getElementById(id);
      btn?.addEventListener('click', () => {
        this.pause();

        document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const p = presets[id];
        const sliderN = document.getElementById('sliderNodes');
        if (sliderN) sliderN.value = p.N;
        document.getElementById('valNodes').textContent = p.N;

        this.engine.totalNodes = p.N;
        this.engine.leaderId = p.leader;

        this.engine.reset(false);

        for (let nodeId in p.behaviors) {
          this.engine.setNodeBehavior(parseInt(nodeId, 10), p.behaviors[nodeId]);
        }

        this.updateLeaderSelectOptions();
        this.updateUI();
      });
    });
  }

  initEngineListeners() {
    this.engine.subscribe(() => {
      this.updateUI();
      if (this.activeModalNodeId !== null) {
        this.renderNodeModalContent(this.activeModalNodeId);
      }
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
      this.engine.reset(true);
    }

    this.isPlaying = true;
    this.renderer.setPaused(false);

    const btn = document.getElementById('btnPlayPause');
    if (btn) {
      btn.innerHTML = '⏸';
      btn.title = '一時停止 (Pause)';
      btn.classList.add('primary');
    }

    if (this.playInterval) clearInterval(this.playInterval);
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
    this.renderer.setPaused(true);

    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }

    const btn = document.getElementById('btnPlayPause');
    if (btn) {
      btn.innerHTML = '▶';
      btn.title = '再生 (Play)';
      btn.classList.remove('primary');
    }
  }

  updateUI() {
    this.updateStatusBanner();
    this.updatePhaseBadge();
    this.renderNodeConfigList();
    this.renderExclusionInspector();
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

    container.querySelectorAll('.node-behavior-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nodeId = parseInt(sel.getAttribute('data-node'), 10);
        const behavior = e.target.value;
        this.engine.setNodeBehavior(nodeId, behavior);
      });
    });
  }

  renderExclusionInspector() {
    const container = document.getElementById('exclusionInspector');
    if (!container) return;

    const qThreshold = this.engine.quorumThreshold;
    const prepareTallies = this.engine.voteTallies.prepare;

    let html = `
      <div style="margin-bottom:0.75rem; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:0.9rem; font-weight:600; color:#fff;">投票集計 & 裏切り意見の排除状況 (Vote Tally & Filtering)</span>
        <span style="font-size:0.8rem; font-family:var(--font-code); color:var(--accent-primary);">必要票数 (2f+1): ${qThreshold}票</span>
      </div>
    `;

    if (prepareTallies.size === 0) {
      html += `
        <div style="font-size:0.85rem; color:var(--text-muted); padding:1rem; text-align:center; background:rgba(0,0,0,0.2); border-radius:var(--radius-md);">
          ▶ 「▶ 再生」または 「❯ ステップ進む」を押すと、Prepareフェーズでの投票集計と裏切り意見の排除プロセスがここにリアルタイム表示されます。
        </div>
      `;
    } else {
      html += `<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:0.75rem;">`;

      prepareTallies.forEach((senders, digest) => {
        const isValid = (digest === this.engine.validPayload.digest);
        const isQuorumPassed = senders.length >= qThreshold;

        const border = isValid ? (isQuorumPassed ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255,255,255,0.1)') : 'rgba(244, 63, 94, 0.4)';
        const bg = isValid ? (isQuorumPassed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.02)') : 'rgba(244, 63, 94, 0.1)';
        const badgeText = isValid ? (isQuorumPassed ? '✅ クオラム達成 (攻撃合意成立)' : '⏳ 票数不足') : '🚫 自動排除 (Traitor Excluded)';
        const badgeColor = isValid ? (isQuorumPassed ? '#34d399' : '#94a3b8') : '#f87171';

        html += `
          <div style="background:${bg}; border:1px solid ${border}; border-radius:var(--radius-md); padding:0.85rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
              <span style="font-family:var(--font-code); font-size:0.8rem; font-weight:700; color:${isValid ? '#60a5fa' : '#f43f5e'};">
                ${isValid ? '⚔️ 攻撃提案 (d_ATTACK)' : '🛡️ 撤退/偽提案 (d_RETREAT)'}
              </span>
              <span style="font-size:0.75rem; font-weight:700; color:${badgeColor}; padding:2px 6px; border-radius:4px; background:rgba(0,0,0,0.3);">
                ${badgeText}
              </span>
            </div>
            <div style="font-size:0.85rem; color:var(--text-main); margin-bottom:0.3rem;">
              獲得票数: <b>${senders.length} / ${qThreshold}</b> 票 (${senders.map(id => `Node ${id}`).join(', ')})
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted);">
              ${isValid 
                ? '正当な「⚔️ 攻撃」提案。正常ノード群の支持により採用。' 
                : '裏切りノードによる改ざん「🛡️ 撤退」投票。2f+1の賛成票に達しないため破棄されました。'}
            </div>
          </div>
        `;
      });

      html += `</div>`;
    }

    container.innerHTML = html;
  }

  showNodeModal(nodeId) {
    this.activeModalNodeId = nodeId;
    const overlay = document.getElementById('nodeModalOverlay');
    this.renderNodeModalContent(nodeId);
    overlay?.classList.add('open');
  }

  renderNodeModalContent(nodeId) {
    const node = this.engine.nodes[nodeId];
    if (!node) return;

    const titleContainer = document.getElementById('nodeModalTitle');
    const bodyContainer = document.getElementById('nodeModalBody');
    const qThreshold = this.engine.quorumThreshold;

    const roleBadge = node.isLeader 
      ? '<span style="background:rgba(245, 158, 11, 0.2); color:#f59e0b; padding:2px 8px; border-radius:4px; font-size:0.75rem; border:1px solid #f59e0b;">★ PRIMARY LEADER</span>'
      : (node.behavior !== 'honest' 
          ? `<span style="background:rgba(244, 63, 94, 0.2); color:#f43f5e; padding:2px 8px; border-radius:4px; font-size:0.75rem; border:1px solid #f43f5e;">⚠ FAULTY (${node.behavior.toUpperCase()})</span>`
          : '<span style="background:rgba(16, 185, 129, 0.2); color:#34d399; padding:2px 8px; border-radius:4px; font-size:0.75rem; border:1px solid #10b981;">🟢 HONEST NODE</span>');

    if (titleContainer) {
      titleContainer.innerHTML = `
        <span style="font-family:var(--font-code);">Node ${node.id} Inspector</span>
        ${roleBadge}
      `;
    }

    if (!bodyContainer) return;

    let html = `
      <div style="background:rgba(0,0,0,0.25); padding:1rem; border-radius:var(--radius-md); border:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:0.8rem; color:var(--text-muted);">現在のフェーズ状態</div>
          <div style="font-size:1.1rem; font-weight:700; color:#fff; font-family:var(--font-code);">${node.state}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.8rem; color:var(--text-muted);">無効/撤退票の拒否件数</div>
          <div style="font-size:1.1rem; font-weight:700; color:${node.rejectedCount > 0 ? '#f43f5e' : '#34d399'}; font-family:var(--font-code);">
            ${node.rejectedCount} 件 拒否/破棄
          </div>
        </div>
      </div>

      <div>
        <h4 style="font-size:0.9rem; color:#fff; margin-bottom:0.5rem; display:flex; justify-content:space-between;">
          <span>1. 受信した提案 (Pre-Prepare Payload)</span>
          <span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted);">From: Node ${this.engine.leaderId}</span>
        </h4>
        ${node.preprepareReceived ? `
          <div style="background:rgba(168, 85, 247, 0.1); border:1px solid rgba(168, 85, 247, 0.3); padding:0.75rem; border-radius:var(--radius-md); font-family:var(--font-code); font-size:0.825rem;">
            <div><b>提案内容:</b> "${node.preprepareReceived.val}"</div>
            <div><b>Digest:</b> <span style="color:#c084fc;">${node.preprepareReceived.digest}</span></div>
          </div>
        ` : `
          <div style="font-size:0.825rem; color:var(--text-dim); padding:0.75rem; background:rgba(0,0,0,0.2); border-radius:var(--radius-md);">
            未受信 (Pre-Prepare提案待ち)
          </div>
        `}
      </div>

      <div>
        <h4 style="font-size:0.9rem; color:#fff; margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;">
          <span>2. 受信した Prepare 投票の内訳 & 検証履歴</span>
          <span style="font-size:0.75rem; font-family:var(--font-code); color:${node.isPrepared ? '#34d399' : '#fbbf24'};">
            ${node.isPrepared ? `✅ クオラム達成 (≥ ${qThreshold}票)` : `⏳ 検証中 (${node.receivedPrepares.filter(p=>p.isValid).length}/${qThreshold}票)`}
          </span>
        </h4>

        <div style="display:flex; flex-direction:column; gap:0.4rem;">
    `;

    if (node.receivedPrepares.length === 0) {
      html += `
        <div style="font-size:0.825rem; color:var(--text-dim); padding:0.75rem; background:rgba(0,0,0,0.2); border-radius:var(--radius-md);">
          まだ Prepare 投票を受信していません。
        </div>
      `;
    } else {
      node.receivedPrepares.forEach(prep => {
        const rowClass = prep.isValid ? 'valid' : 'invalid';
        const badge = prep.isValid 
          ? '<span style="color:#34d399; font-weight:600;">⚔️ 有効「攻撃」票 (VALID)</span>' 
          : '<span style="color:#f43f5e; font-weight:600;">🛡️ 破棄「撤退」票 (REJECTED)</span>';

        html += `
          <div class="vote-item-row ${rowClass}">
            <div>
              <span style="font-weight:600; font-family:var(--font-code);">Node ${prep.senderId}</span>
              <span style="color:var(--text-muted); margin-left:0.5rem; font-family:var(--font-code);">Digest: ${prep.digest}</span>
            </div>
            <div>${badge}</div>
          </div>
        `;
      });
    }

    html += `
        </div>
      </div>

      <div>
        <h4 style="font-size:0.9rem; color:#fff; margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;">
          <span>3. 受信した Commit 投票の内訳 & 確定状態</span>
          <span style="font-size:0.75rem; font-family:var(--font-code); color:${node.isCommitted ? '#34d399' : '#fbbf24'};">
            ${node.isCommitted ? `✅ トランザクション確定 (COMMITTED)` : `⏳ 未確定`}
          </span>
        </h4>

        <div style="display:flex; flex-direction:column; gap:0.4rem;">
    `;

    if (node.receivedCommits.length === 0) {
      html += `
        <div style="font-size:0.825rem; color:var(--text-dim); padding:0.75rem; background:rgba(0,0,0,0.2); border-radius:var(--radius-md);">
          まだ Commit 投票を受信していません。
        </div>
      `;
    } else {
      node.receivedCommits.forEach(comm => {
        const rowClass = comm.isValid ? 'valid' : 'invalid';
        const badge = comm.isValid 
          ? '<span style="color:#34d399; font-weight:600;">⚔️ Commit 承認 (ATTACK)</span>' 
          : '<span style="color:#f43f5e; font-weight:600;">🛡️ Commit 否決 (RETREAT)</span>';

        html += `
          <div class="vote-item-row ${rowClass}">
            <div>
              <span style="font-weight:600; font-family:var(--font-code);">Node ${comm.senderId}</span>
              <span style="color:var(--text-muted); margin-left:0.5rem; font-family:var(--font-code);">Digest: ${comm.digest}</span>
            </div>
            <div>${badge}</div>
          </div>
        `;
      });
    }

    html += `
        </div>
      </div>
    `;

    bodyContainer.innerHTML = html;
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
        <tr style="cursor:pointer;" class="matrix-row-clickable" data-node="${node.id}">
          <td style="font-weight:600; font-family:var(--font-code);">
            Node ${node.id} ${node.isLeader ? '★' : ''} ${node.rejectedCount > 0 ? `<span style="color:#f43f5e; font-size:0.75rem;">(🚫 ${node.rejectedCount}件拒否)</span>` : ''}
          </td>
          <td><span class="quorum-pill ${preClass}">${isPre}</span></td>
          <td><span class="quorum-pill ${prepClass}">${prepStatus}</span></td>
          <td><span class="quorum-pill ${commClass}">${commStatus}</span></td>
          <td><span class="quorum-pill ${replyClass}">${replyStatus}</span></td>
        </tr>
      `;
    });

    tbody.innerHTML = html;

    tbody.querySelectorAll('.matrix-row-clickable').forEach(row => {
      row.addEventListener('click', () => {
        const nodeId = parseInt(row.getAttribute('data-node'), 10);
        this.showNodeModal(nodeId);
      });
    });
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

window.addEventListener('DOMContentLoaded', () => {
  new UIController();
});
