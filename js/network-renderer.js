/**
 * Network Canvas Visualizer for BFT Simulation
 * Renders nodes, topology links, phase states, glowing pulses, and message particles,
 * with explicit visual distinction for ⚔️ ATTACK (Valid) vs 🛡️ RETREAT (Traitor) packets.
 * Supports mid-flight particle pausing and resuming.
 */

export class NetworkRenderer {
  constructor(canvasElement, bftEngine, onNodeClickCallback) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.engine = bftEngine;
    this.onNodeClick = onNodeClickCallback;
    
    this.nodePositions = new Map();
    this.clientPosition = { x: 0, y: 0 };
    this.activeParticles = [];
    this.rejectionBadges = [];
    this.hoveredNodeId = null;
    this.particleSpeed = 0.005;
    this.isPaused = false;
    
    this.animId = null;
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.initCanvasInteractivity();

    this.engine.subscribe(() => {
      this.syncMessagesFromEngine();
    });

    this.startAnimationLoop();
  }

  setPaused(paused) {
    this.isPaused = paused;
  }

  clearParticles() {
    this.activeParticles = [];
    this.rejectionBadges = [];
  }

  setSpeed(stepMs) {
    // Scale particle travel so movement begins immediately and completes in ~75% of stepMs
    const framesPerStep = Math.max(15, stepMs / 16.6);
    this.particleSpeed = Math.min(0.06, Math.max(0.002, 1.0 / (framesPerStep * 0.75)));
  }

  initCanvasInteractivity() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let hovered = null;
      this.nodePositions.forEach((pos, nodeId) => {
        const dist = Math.hypot(mouseX - pos.x, mouseY - pos.y);
        if (dist <= 28) {
          hovered = nodeId;
        }
      });

      this.hoveredNodeId = hovered;
      this.canvas.style.cursor = (hovered !== null) ? 'pointer' : 'default';
    });

    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      this.nodePositions.forEach((pos, nodeId) => {
        const dist = Math.hypot(mouseX - pos.x, mouseY - pos.y);
        if (dist <= 28) {
          if (this.onNodeClick) {
            this.onNodeClick(nodeId);
          }
        }
      });
    });
  }

  resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = this.canvas.width = rect.width || 800;
    this.height = this.canvas.height = rect.height || 480;
    this.calculatePositions();
  }

  calculatePositions() {
    this.nodePositions.clear();
    const centerX = this.width / 2;
    const centerY = this.height / 2 + 20;
    const radius = Math.min(this.width, this.height) * 0.32;
    
    this.clientPosition = { x: centerX, y: 60 };

    const total = this.engine.totalNodes;
    for (let i = 0; i < total; i++) {
      const angle = (i * 2 * Math.PI / total) - (Math.PI / 2);
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      this.nodePositions.set(i, { x, y, angle });
    }
  }

  syncMessagesFromEngine() {
    while (this.engine.inFlightMessages.length > 0) {
      const msg = this.engine.inFlightMessages.shift();
      const startPos = msg.from === 'CLIENT' ? this.clientPosition : this.nodePositions.get(msg.from);
      const endPos = msg.to === 'CLIENT' ? this.clientPosition : this.nodePositions.get(msg.to);

      if (startPos && endPos) {
        const intent = msg.payload?.intent || (msg.payload?.digest?.includes('RETREAT') ? 'RETREAT' : 'ATTACK');
        this.activeParticles.push({
          start: { ...startPos },
          end: { ...endPos },
          progress: 0,
          speed: this.particleSpeed || 0.005,
          type: msg.type,
          intent: intent,
          label: intent === 'RETREAT' ? '🛡️ 撤退 (RETREAT)' : '⚔️ 攻撃 (ATTACK)'
        });
      }
    }

    while (this.engine.rejectedMessages.length > 0) {
      const rej = this.engine.rejectedMessages.shift();
      const pos = this.nodePositions.get(rej.nodeId);
      if (pos) {
        this.rejectionBadges.push({
          x: pos.x,
          y: pos.y - 35,
          opacity: 1.0,
          label: `🚫 撤退/偽票を破棄 (From N${rej.fromNodeId})`
        });
      }
    }
  }

  startAnimationLoop() {
    const render = () => {
      this.draw();
      this.animId = requestAnimationFrame(render);
    };
    render();
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.calculatePositions();

    this.drawLinks();
    this.drawClientNode();
    this.drawNodes();
    this.drawParticles();
    this.drawRejectionBadges();
  }

  drawLinks() {
    const total = this.engine.totalNodes;
    this.ctx.lineWidth = 1;
    
    for (let i = 0; i < total; i++) {
      const p1 = this.nodePositions.get(i);
      for (let j = i + 1; j < total; j++) {
        const p2 = this.nodePositions.get(j);
        if (p1 && p2) {
          this.ctx.beginPath();
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
          this.ctx.stroke();
        }
      }

      if (p1) {
        this.ctx.beginPath();
        this.ctx.setLineDash([4, 4]);
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(this.clientPosition.x, this.clientPosition.y);
        this.ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)';
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }
    }
  }

  drawClientNode() {
    const { x, y } = this.clientPosition;
    
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(x, y, 22, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    this.ctx.strokeStyle = '#6366f1';
    this.ctx.lineWidth = 2;
    this.ctx.shadowColor = 'rgba(99, 102, 241, 0.5)';
    this.ctx.shadowBlur = 12;
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = '#f8fafc';
    this.ctx.font = 'bold 11px Inter, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('CLIENT', x, y);
    this.ctx.restore();
  }

  drawNodes() {
    for (let node of this.engine.nodes) {
      const pos = this.nodePositions.get(node.id);
      if (!pos) continue;

      const { x, y } = pos;
      const isLeader = node.isLeader;
      const isByzantine = node.behavior !== 'honest';
      const isSilent = node.behavior === 'silent';
      const isHovered = (this.hoveredNodeId === node.id);

      let strokeColor = '#10b981';
      let glowColor = 'rgba(16, 185, 129, 0.4)';

      if (isLeader) {
        strokeColor = '#f59e0b';
        glowColor = 'rgba(245, 158, 11, 0.5)';
      }
      
      if (isByzantine) {
        strokeColor = '#f43f5e';
        glowColor = 'rgba(244, 63, 94, 0.5)';
      }

      if (isSilent) {
        strokeColor = '#64748b';
        glowColor = 'transparent';
      }

      if (isHovered) {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(x, y, 32, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([4, 4]);
        this.ctx.stroke();
        this.ctx.restore();
      }

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(x, y, isHovered ? 28 : 26, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(10, 15, 30, 0.95)';
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = isLeader ? 3 : 2;
      this.ctx.shadowColor = glowColor;
      this.ctx.shadowBlur = isHovered ? 25 : 15;
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 13px JetBrains Mono, monospace';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(`N${node.id}`, x, y - 2);

      this.ctx.font = '9px Inter, sans-serif';
      this.ctx.fillStyle = isLeader ? '#f59e0b' : (isByzantine ? '#f43f5e' : '#94a3b8');
      this.ctx.fillText(isLeader ? '★ LEADER' : (isByzantine ? '⚠ FAULTY' : 'HONEST'), x, y + 12);

      this.drawNodeStatusPill(node, x, y + 42);

      this.ctx.restore();
    }
  }

  drawNodeStatusPill(node, x, y) {
    let text = node.state;
    let bg = 'rgba(255, 255, 255, 0.05)';
    let color = '#94a3b8';

    if (node.isCommitted) {
      text = '✓ COMMITTED';
      bg = 'rgba(16, 185, 129, 0.2)';
      color = '#34d399';
    } else if (node.isPrepared) {
      text = '✓ PREPARED';
      bg = 'rgba(59, 130, 246, 0.2)';
      color = '#60a5fa';
    } else if (node.state === 'PREPREPARED') {
      text = 'PRE-PREP';
      bg = 'rgba(168, 85, 247, 0.2)';
      color = '#c084fc';
    }

    this.ctx.save();
    this.ctx.font = 'bold 9px JetBrains Mono, monospace';
    const textWidth = this.ctx.measureText(text).width;
    const paddingH = 8;
    const height = 16;

    this.ctx.beginPath();
    this.ctx.roundRect(x - textWidth/2 - paddingH, y - height/2, textWidth + paddingH*2, height, 8);
    this.ctx.fillStyle = bg;
    this.ctx.fill();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    this.ctx.fillStyle = color;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, x, y);
    this.ctx.restore();
  }

  drawParticles() {
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      
      if (!this.isPaused) {
        p.progress += p.speed;
      }

      if (p.progress >= 1) {
        this.activeParticles.splice(i, 1);
        continue;
      }

      const currentX = p.start.x + (p.end.x - p.start.x) * p.progress;
      const currentY = p.start.y + (p.end.y - p.start.y) * p.progress;

      const isTraitor = (p.intent === 'RETREAT');
      const color = isTraitor ? '#f43f5e' : (p.type === 'REQUEST' ? '#6366f1' : '#10b981');
      const labelText = isTraitor ? '🛡️ 撤退 (RETREAT)' : `⚔️ 攻撃 (${p.type})`;

      this.ctx.save();

      if (isTraitor) {
        this.ctx.beginPath();
        this.ctx.arc(currentX, currentY, 12, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([2, 2]);
        this.ctx.stroke();
      }

      this.ctx.beginPath();
      this.ctx.arc(currentX, currentY, 7, 0, Math.PI * 2);
      this.ctx.fillStyle = color;
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = 12;
      this.ctx.fill();

      this.ctx.font = 'bold 9px Inter, sans-serif';
      this.ctx.fillStyle = isTraitor ? '#fca5a5' : '#ffffff';
      this.ctx.fillText(labelText, currentX + 10, currentY - 8);

      this.ctx.restore();
    }
  }

  drawRejectionBadges() {
    for (let i = this.rejectionBadges.length - 1; i >= 0; i--) {
      const b = this.rejectionBadges[i];
      
      if (!this.isPaused) {
        b.y -= 0.3;
        b.opacity -= 0.008;
      }

      if (b.opacity <= 0) {
        this.rejectionBadges.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = b.opacity;
      this.ctx.font = 'bold 10px Inter, sans-serif';
      
      const metrics = this.ctx.measureText(b.label);
      const w = metrics.width + 12;
      const h = 18;

      this.ctx.beginPath();
      this.ctx.roundRect(b.x - w/2, b.y - h/2, w, h, 4);
      this.ctx.fillStyle = 'rgba(244, 63, 94, 0.9)';
      this.ctx.fill();

      this.ctx.fillStyle = '#ffffff';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(b.label, b.x, b.y);

      this.ctx.restore();
    }
  }
}
