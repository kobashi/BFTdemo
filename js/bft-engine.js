/**
 * Practical Byzantine Fault Tolerance (PBFT) Simulation Engine
 * Manages consensus state, rounds, node behaviors, and quorum calculations.
 */

export class BFTEngine {
  constructor(totalNodes = 4, leaderId = 0) {
    this.totalNodes = totalNodes;
    this.leaderId = leaderId;
    this.nodes = [];
    this.currentPhase = 'REQUEST'; // REQUEST, PREPREPARE, PREPARE, COMMIT, REPLY, COMPLETED, FAILED
    this.currentView = 0;
    this.sequenceNumber = 1;
    this.requestPayload = { val: "TRANSFER $100 -> ALICE", digest: "d_0x8f3" };
    
    this.inFlightMessages = [];
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
    // 2f + 1 quorum needed for consensus
    const f = this.maxFaultyAllowed;
    return 2 * f + 1;
  }

  get isFormulaSatisfied() {
    const f = this.currentFaultyCount;
    return this.totalNodes >= (3 * f + 1);
  }

  initNodes() {
    this.nodes = [];
    for (let i = 0; i < this.totalNodes; i++) {
      this.nodes.push({
        id: i,
        isLeader: (i === this.leaderId),
        behavior: 'honest', // 'honest', 'silent', 'lie_split', 'corrupt'
        state: 'IDLE',
        preprepareReceived: null,
        prepareStore: new Map(), // senderId -> digest
        commitStore: new Map(),  // senderId -> digest
        isPrepared: false,
        isCommitted: false,
        replied: false
      });
    }
  }

  setTotalNodes(n) {
    this.totalNodes = Math.max(3, Math.min(12, n));
    if (this.leaderId >= this.totalNodes) {
      this.leaderId = 0;
    }
    this.reset();
  }

  setLeaderId(id) {
    if (id >= 0 && id < this.totalNodes) {
      this.leaderId = id;
      this.reset();
    }
  }

  setNodeBehavior(nodeId, behavior) {
    if (this.nodes[nodeId]) {
      this.nodes[nodeId].behavior = behavior;
      this.notifyStateChange();
    }
  }

  reset() {
    this.currentPhase = 'REQUEST';
    this.inFlightMessages = [];
    this.logs = [];
    this.initNodes();
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
    this.addLog('system', `Client submits request: "${this.requestPayload.val}" to Primary Node ${this.leaderId}`);
    
    // Animate Client -> Leader packet
    this.inFlightMessages.push({
      from: 'CLIENT',
      to: this.leaderId,
      type: 'REQUEST',
      payload: { ...this.requestPayload },
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

    this.addLog('preprepare', `Primary Node ${leader.id} broadcasts Pre-Prepare message to all nodes.`);
    
    // Leader accepts its own proposal
    leader.preprepareReceived = { ...this.requestPayload };
    leader.state = 'PREPREPARED';

    for (let target of this.nodes) {
      if (target.id === leader.id) continue;

      let payload = { ...this.requestPayload };
      
      // Handle leader Byzantine behavior
      if (leader.behavior === 'corrupt') {
        payload.digest = "d_CORRUPTED_FAKE";
      } else if (leader.behavior === 'lie_split') {
        // Send true message to even nodes, false digest to odd nodes
        if (target.id % 2 === 1) {
          payload.val = "TRANSFER $9999 -> HACKER";
          payload.digest = "d_FORGED_TRANS";
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
    this.addLog('prepare', `Nodes process Pre-Prepare and broadcast Prepare messages across network.`);

    // First deliver pre-prepare payloads to targets
    for (let node of this.nodes) {
      if (node.id === this.leaderId) continue;
      if (node.behavior === 'silent') continue;
      
      // Receive payload from leader
      node.preprepareReceived = { ...this.requestPayload };
      node.state = 'PREPREPARED';
    }

    // Now nodes broadcast Prepare to everyone
    for (let sender of this.nodes) {
      if (sender.behavior === 'silent') {
        this.addLog('system', `Node ${sender.id} is silent, sending no Prepare messages.`);
        continue;
      }

      for (let target of this.nodes) {
        if (target.id === sender.id) continue;

        let digest = this.requestPayload.digest;
        if (sender.behavior === 'corrupt') {
          digest = "d_CORRUPT_PREPARE";
        } else if (sender.behavior === 'lie_split' && target.id % 2 === 0) {
          digest = "d_LIE_SPLIT_PREPARE";
        }

        this.inFlightMessages.push({
          from: sender.id,
          to: target.id,
          type: 'PREPARE',
          payload: { digest, senderId: sender.id },
          progress: 0
        });
      }
    }

    // Process quorum check for Prepare
    this.checkPrepareQuorums();
    this.currentPhase = 'COMMIT';
    this.notifyStateChange();
  }

  checkPrepareQuorums() {
    const validDigest = this.requestPayload.digest;
    const requiredQuorum = this.quorumThreshold; // 2f + 1

    for (let node of this.nodes) {
      if (node.behavior === 'silent') continue;

      let validPrepares = 1; // Include self/leader preprepare
      
      for (let sender of this.nodes) {
        if (sender.id === node.id) continue;
        if (sender.behavior === 'honest' || (sender.behavior !== 'silent' && sender.behavior !== 'corrupt')) {
          validPrepares++;
        }
      }

      if (validPrepares >= requiredQuorum) {
        node.isPrepared = true;
        node.state = 'PREPARED';
      }
    }
  }

  executeCommitPhase() {
    this.addLog('commit', `Prepared nodes broadcast Commit messages to achieve total order commitment.`);

    for (let sender of this.nodes) {
      if (!sender.isPrepared || sender.behavior === 'silent') continue;

      for (let target of this.nodes) {
        if (target.id === sender.id) continue;

        let digest = this.requestPayload.digest;
        if (sender.behavior === 'corrupt') digest = "d_BAD_COMMIT";

        this.inFlightMessages.push({
          from: sender.id,
          to: target.id,
          type: 'COMMIT',
          payload: { digest, senderId: sender.id },
          progress: 0
        });
      }
    }

    this.checkCommitQuorums();
    this.currentPhase = 'REPLY';
    this.notifyStateChange();
  }

  checkCommitQuorums() {
    const requiredQuorum = this.quorumThreshold; // 2f + 1

    let committedCount = 0;
    for (let node of this.nodes) {
      if (node.behavior === 'silent') continue;

      let validCommits = 0;
      for (let sender of this.nodes) {
        if (sender.behavior === 'honest') validCommits++;
      }

      if (validCommits >= requiredQuorum) {
        node.isCommitted = true;
        node.state = 'COMMITTED';
        committedCount++;
      }
    }

    if (committedCount >= requiredQuorum) {
      this.addLog('system', `Quorum reached! ${committedCount}/${this.totalNodes} nodes achieved COMMITTED state.`);
    } else {
      this.addLog('error', `Failed to reach commit quorum (${committedCount}/${requiredQuorum} needed).`);
    }
  }

  executeReplyPhase() {
    this.addLog('reply', `Committed nodes reply directly to the Client.`);

    let repliesCount = 0;
    for (let node of this.nodes) {
      if (node.isCommitted && node.behavior !== 'silent') {
        node.replied = true;
        repliesCount++;

        this.inFlightMessages.push({
          from: node.id,
          to: 'CLIENT',
          type: 'REPLY',
          payload: { result: "SUCCESS", node: node.id },
          progress: 0
        });
      }
    }

    if (repliesCount >= this.quorumThreshold) {
      this.currentPhase = 'COMPLETED';
      this.addLog('system', `🎉 CONSENSUS ACHIEVED! Client received ${repliesCount} valid matching replies (Threshold ${this.quorumThreshold}).`);
    } else {
      this.currentPhase = 'FAILED';
      this.addLog('error', `❌ CONSENSUS FAILED! Client received only ${repliesCount}/${this.quorumThreshold} matching replies.`);
    }

    this.notifyStateChange();
  }
}
