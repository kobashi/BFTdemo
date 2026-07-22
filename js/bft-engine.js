/**
 * Practical Byzantine Fault Tolerance (PBFT) Simulation Engine
 * Manages consensus state, rounds, node behaviors, vote tallies, and explicit rejection tracking.
 * Framing: Byzantine Generals Problem (⚔️ ATTACK vs 🛡️ RETREAT/FORGED).
 */

export class BFTEngine {
  constructor(totalNodes = 4, leaderId = 0) {
    this.totalNodes = totalNodes;
    this.leaderId = leaderId;
    this.nodes = [];
    this.currentPhase = 'REQUEST'; // REQUEST, PREPREPARE, PREPARE, COMMIT, REPLY, COMPLETED, FAILED
    this.currentView = 0;
    this.sequenceNumber = 1;
    this.validPayload = { val: "⚔️ 攻撃 (ATTACK)", digest: "d_ATTACK_0x8F3", intent: "ATTACK" };
    
    this.inFlightMessages = [];
    this.rejectedMessages = [];
    this.voteTallies = {
      prepare: new Map(),
      commit: new Map()
    };

    this.logs = [];
    this.onStateChangeCallbacks = [];
    
    this.initNodes();
  }

  get maxFaultyAllowed() {
    return Math.floor((this.totalNodes - 1) / 3);
  }

  get currentFaultyCount() {
    return this.nodes.filter(n => n.behavior !== 'honest').length;
  }

  get quorumThreshold() {
    const f = this.maxFaultyAllowed;
    return 2 * f + 1;
  }

  get isFormulaSatisfied() {
    const f = this.currentFaultyCount;
    return this.totalNodes >= (3 * f + 1);
  }

  initNodes(preserveBehaviors = true) {
    const existingBehaviors = new Map(preserveBehaviors && this.nodes ? this.nodes.map(n => [n.id, n.behavior]) : []);
    this.nodes = [];
    for (let i = 0; i < this.totalNodes; i++) {
      this.nodes.push({
        id: i,
        isLeader: (i === this.leaderId),
        behavior: existingBehaviors.get(i) || 'honest',
        state: 'IDLE',
        preprepareReceived: null,
        receivedPrepares: [],
        receivedCommits: [],
        isPrepared: false,
        isCommitted: false,
        replied: false,
        rejectedCount: 0
      });
    }
  }

  setTotalNodes(n) {
    this.totalNodes = Math.max(3, Math.min(12, n));
    if (this.leaderId >= this.totalNodes) {
      this.leaderId = 0;
    }
    this.reset(true);
  }

  setLeaderId(id) {
    if (id >= 0 && id < this.totalNodes) {
      this.leaderId = id;
      this.reset(true);
    }
  }

  setNodeBehavior(nodeId, behavior) {
    if (this.nodes[nodeId]) {
      this.nodes[nodeId].behavior = behavior;
      this.notifyStateChange();
    }
  }

  reset(preserveBehaviors = true) {
    this.currentPhase = 'REQUEST';
    this.inFlightMessages = [];
    this.rejectedMessages = [];
    this.voteTallies = { prepare: new Map(), commit: new Map() };
    this.logs = [];
    this.initNodes(preserveBehaviors);
    this.addLog('system', `Simulation reset. N=${this.totalNodes}, Leader=Node ${this.leaderId}`);
    this.notifyStateChange();
  }

  addLog(type, message) {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.logs.unshift({ time, type, message });
    if (this.logs.length > 100) this.logs.pop();
  }

  subscribe(callback) {
    this.onStateChangeCallbacks.push(callback);
  }

  notifyStateChange() {
    this.onStateChangeCallbacks.forEach(cb => cb(this));
  }

  /* --- PBFT Step Execution --- */

  stepNext() {
    switch (this.currentPhase) {
      case 'REQUEST':
        this.executeRequestPhase();
        break;
      case 'PREPREPARE':
        this.executePrePreparePhase();
        break;
      case 'PREPARE':
        this.executePreparePhase();
        break;
      case 'COMMIT':
        this.executeCommitPhase();
        break;
      case 'REPLY':
        this.executeReplyPhase();
        break;
      default:
        break;
    }
  }

  executeRequestPhase() {
    this.addLog('system', `Client submits proposal request: "${this.validPayload.val}" to Primary Node ${this.leaderId}`);
    
    this.inFlightMessages.push({
      from: 'CLIENT',
      to: this.leaderId,
      type: 'REQUEST',
      payload: { ...this.validPayload },
      progress: 0
    });

    this.currentPhase = 'PREPREPARE';
    this.notifyStateChange();
  }

  executePrePreparePhase() {
    const leader = this.nodes[this.leaderId];
    
    if (leader.behavior === 'silent') {
      this.addLog('error', `Primary Node ${leader.id} is Silent/Offline! Pre-Prepare broadcast failed.`);
      this.currentPhase = 'FAILED';
      this.notifyStateChange();
      return;
    }

    this.addLog('preprepare', `Primary Node ${leader.id} broadcasts Pre-Prepare proposal.`);
    
    leader.preprepareReceived = { ...this.validPayload };
    leader.state = 'PREPREPARED';

    for (let target of this.nodes) {
      if (target.id === leader.id) continue;

      let payload = { ...this.validPayload };
      
      if (leader.behavior === 'corrupt') {
        payload.val = "🛡️ 撤退 (RETREAT)";
        payload.digest = "d_RETREAT_BYZ";
        payload.intent = "RETREAT";
      } else if (leader.behavior === 'lie_split') {
        if (target.id % 2 === 1) {
          payload.val = "🛡️ 撤退 (RETREAT)";
          payload.digest = "d_RETREAT_BYZ";
          payload.intent = "RETREAT";
        }
      }

      this.inFlightMessages.push({
        from: leader.id,
        to: target.id,
        type: 'PREPREPARE',
        payload: payload,
        progress: 0
      });
    }

    this.currentPhase = 'PREPARE';
    this.notifyStateChange();
  }

  executePreparePhase() {
    this.addLog('prepare', `Nodes evaluate Pre-Prepare proposals and broadcast Prepare votes.`);

    for (let node of this.nodes) {
      if (node.id === this.leaderId) continue;
      if (node.behavior === 'silent') continue;
      
      let receivedVal = { ...this.validPayload };
      if (this.nodes[this.leaderId].behavior === 'lie_split' && node.id % 2 === 1) {
        receivedVal = { val: "🛡️ 撤退 (RETREAT)", digest: "d_RETREAT_BYZ", intent: "RETREAT" };
      } else if (this.nodes[this.leaderId].behavior === 'corrupt') {
        receivedVal = { val: "🛡️ 撤退 (RETREAT)", digest: "d_RETREAT_BYZ", intent: "RETREAT" };
      }

      node.preprepareReceived = receivedVal;
      node.state = 'PREPREPARED';
    }

    for (let sender of this.nodes) {
      if (sender.behavior === 'silent') {
        this.addLog('system', `Node ${sender.id} is Silent (Crash Fault). No Prepare message sent.`);
        continue;
      }

      for (let target of this.nodes) {
        if (target.id === sender.id) continue;

        let digest = sender.preprepareReceived ? sender.preprepareReceived.digest : this.validPayload.digest;
        let intent = sender.preprepareReceived ? (sender.preprepareReceived.intent || "ATTACK") : "ATTACK";

        if (sender.behavior === 'corrupt') {
          digest = "d_RETREAT_BYZ";
          intent = "RETREAT";
        } else if (sender.behavior === 'lie_split' && target.id % 2 === 0) {
          digest = "d_RETREAT_BYZ";
          intent = "RETREAT";
        }

        this.inFlightMessages.push({
          from: sender.id,
          to: target.id,
          type: 'PREPARE',
          payload: { digest, intent, senderId: sender.id },
          progress: 0
        });
      }
    }

    this.processPrepareVoting();
    this.currentPhase = 'COMMIT';
    this.notifyStateChange();
  }

  processPrepareVoting() {
    const requiredQuorum = this.quorumThreshold;
    const prepareTallies = new Map();

    for (let node of this.nodes) {
      if (node.behavior === 'silent') continue;

      node.receivedPrepares = [];
      const expectedDigest = this.validPayload.digest;

      for (let sender of this.nodes) {
        let digest = sender.preprepareReceived ? sender.preprepareReceived.digest : expectedDigest;
        
        if (sender.behavior === 'corrupt') digest = "d_RETREAT_BYZ";
        else if (sender.behavior === 'lie_split' && node.id % 2 === 0) digest = "d_RETREAT_BYZ";

        if (sender.behavior === 'silent') continue;

        const isValid = (digest === expectedDigest);
        node.receivedPrepares.push({ senderId: sender.id, digest, isValid });

        if (!prepareTallies.has(digest)) prepareTallies.set(digest, []);
        if (!prepareTallies.get(digest).includes(sender.id)) {
          prepareTallies.get(digest).push(sender.id);
        }

        if (!isValid) {
          node.rejectedCount++;
          this.rejectedMessages.push({
            phase: 'PREPARE',
            nodeId: node.id,
            fromNodeId: sender.id,
            badDigest: digest,
            reason: 'Traitor vote (🛡️ RETREAT) rejected by honest node'
          });
          this.addLog('error', `🚫 Node ${node.id} REJECTED Traitor vote (🛡️ RETREAT) from Node ${sender.id}`);
        }
      }

      const validVoteCount = node.receivedPrepares.filter(p => p.isValid).length;
      if (validVoteCount >= requiredQuorum) {
        node.isPrepared = true;
        node.state = 'PREPARED';
      }
    }

    this.voteTallies.prepare = prepareTallies;
  }

  executeCommitPhase() {
    this.addLog('commit', `Prepared nodes broadcast Commit votes to reach final order commitment.`);

    for (let sender of this.nodes) {
      if (!sender.isPrepared || sender.behavior === 'silent') continue;

      for (let target of this.nodes) {
        if (target.id === sender.id) continue;

        let digest = this.validPayload.digest;
        let intent = "ATTACK";

        if (sender.behavior === 'corrupt') {
          digest = "d_RETREAT_BYZ";
          intent = "RETREAT";
        }

        this.inFlightMessages.push({
          from: sender.id,
          to: target.id,
          type: 'COMMIT',
          payload: { digest, intent, senderId: sender.id },
          progress: 0
        });
      }
    }

    this.processCommitVoting();
    this.currentPhase = 'REPLY';
    this.notifyStateChange();
  }

  processCommitVoting() {
    const requiredQuorum = this.quorumThreshold;
    const commitTallies = new Map();

    for (let node of this.nodes) {
      if (node.behavior === 'silent') continue;

      node.receivedCommits = [];
      const expectedDigest = this.validPayload.digest;

      for (let sender of this.nodes) {
        if (!sender.isPrepared || sender.behavior === 'silent') continue;

        let digest = expectedDigest;
        if (sender.behavior === 'corrupt') digest = "d_RETREAT_BYZ";

        const isValid = (digest === expectedDigest);
        node.receivedCommits.push({ senderId: sender.id, digest, isValid });

        if (!commitTallies.has(digest)) commitTallies.set(digest, []);
        if (!commitTallies.get(digest).includes(sender.id)) {
          commitTallies.get(digest).push(sender.id);
        }

        if (!isValid) {
          node.rejectedCount++;
          this.rejectedMessages.push({
            phase: 'COMMIT',
            nodeId: node.id,
            fromNodeId: sender.id,
            badDigest: digest,
            reason: 'Traitor commit vote rejected'
          });
          this.addLog('error', `🚫 Node ${node.id} REJECTED Traitor commit vote from Node ${sender.id}`);
        }
      }

      const validCommits = node.receivedCommits.filter(c => c.isValid).length;
      if (validCommits >= requiredQuorum) {
        node.isCommitted = true;
        node.state = 'COMMITTED';
      }
    }

    this.voteTallies.commit = commitTallies;
  }

  executeReplyPhase() {
    this.addLog('reply', `Committed nodes send final transaction execution replies to Client.`);

    let validRepliesCount = 0;
    for (let node of this.nodes) {
      if (node.isCommitted && node.behavior !== 'silent') {
        node.replied = true;
        validRepliesCount++;

        this.inFlightMessages.push({
          from: node.id,
          to: 'CLIENT',
          type: 'REPLY',
          payload: { result: "SUCCESS", node: node.id, digest: this.validPayload.digest, intent: "ATTACK" },
          progress: 0
        });
      }
    }

    if (validRepliesCount >= this.quorumThreshold) {
      this.currentPhase = 'COMPLETED';
      this.addLog('system', `🎉 CONSENSUS ACHIEVED! Client received ${validRepliesCount} matching "⚔️ 攻撃 (ATTACK)" replies (Threshold ${this.quorumThreshold}). Traitor "🛡️ 撤退 (RETREAT)" votes successfully isolated!`);
    } else {
      this.currentPhase = 'FAILED';
      this.addLog('error', `❌ CONSENSUS FAILED! Client received only ${validRepliesCount}/${this.quorumThreshold} valid replies. Quorum condition unsatisfied.`);
    }

    this.notifyStateChange();
  }
}
