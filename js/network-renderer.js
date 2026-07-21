/**
 * Network Canvas Visualizer for BFT Simulation
 * Renders nodes, topology links, phase states, glowing pulses, and message particles.
 */

export class NetworkRenderer {
  constructor(canvasElement, bftEngine) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.engine = bftEngine;
    
    this.nodePositions = new Map();
    this.clientPosition = { x: 0, y: 0 };
    this.activeParticles = [];
    
    this.animId = null;
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.engine.subscribe(() => {
      this.syncMessagesFromEngine();
    });

    this.startAnimationLoop();
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
    
    // Position Client at top
    this.clientPosition = { x: centerX, y: 60 };

    // Arrange nodes evenly in a circle around center
    const total = this.engine.totalNodes;
    for (let i = 0; i < total; i++) {
      // Start angle from top (-PI/2)
      const angle = (i * 2 * Math.PI / total) - (Math.PI / 2);
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      this.nodePositions.set(i, { x, y, angle });
    }
  }

  syncMessagesFromEngine() {
    // Convert new inFlightMessages to animated particles
    while (this.engine.inFlightMessages.length > 0) {
      const msg = this.engine.inFlightMessages.shift();
      const startPos = msg.from === 'CLIENT' ? this.clientPosition : this.nodePositions.get(msg.from);
      const endPos = msg.to === 'CLIENT' ? this.clientPosition : this.nodePositions.get(msg.to);

      if (startPos && endPos) {
        this.activeParticles.push({
          start: { ...startPos },
          end: { ...endPos },
          progress: 0,
          speed: 0.015,
          type: msg.type,
          label: msg.payload?.digest || msg.type
        });
      }
    }
  }

  getPhaseColor(type) {
    switch (type) {
      case 'REQUEST': return '#6366f1';
      case 'PREPREPARE': return '#a855f7';
      case 'PREPARE': return '#3b82f6';
      case 'COMMIT': return '#10b981';
      case 'REPLY': return '#f59e0b';
      default: return '#94a3b8';
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

    // 1. Draw Network Links (Background mesh)
    this.drawLinks();

    // 2. Draw Client Node
    this.drawClientNode();

    // 3. Draw Engine Consensus Nodes
    this.drawNodes();

    // 4. Update and Draw Particles
    this.drawParticles();
  }

  drawLinks() {
    const total = this.engine.totalNodes;
    this.ctx.lineWidth = 1;
    
    // Mesh links between all consensus nodes
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

      // Link to Client
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

      let strokeColor = '#10b981'; // Green for Honest
      let glowColor = 'rgba(16, 185, 129, 0.4)';
      let badgeLabel = 'HONEST';

      if (isLeader) {
        strokeColor = '#f59e0b'; // Gold
        glowColor = 'rgba(245, 158, 11, 0.5)';
        badgeLabel = 'PRIMARY';
      }
      
      if (isByzantine) {
        strokeColor = '#f43f5e'; // Red
        glowColor = 'rgba(244, 63, 94, 0.5)';
        badgeLabel = node.behavior.toUpperCase();
      }

      if (isSilent) {
        strokeColor = '#64748b';
        glowColor = 'transparent';
      }

      // Draw Node Outer Circle with Glow
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(x, y, 26, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(10, 15, 30, 0.95)';
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = isLeader ? 3 : 2;
      this.ctx.shadowColor = glowColor;
      this.ctx.shadowBlur = 15;
      this.ctx.fill();
      this.ctx.stroke();

      // Node ID Text
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 13px JetBrains Mono, monospace';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(`N${node.id}`, x, y - 2);

      // Node State / Role Subtext
      this.ctx.font = '9px Inter, sans-serif';
      this.ctx.fillStyle = isLeader ? '#f59e0b' : (isByzantine ? '#f43f5e' : '#94a3b8');
      this.ctx.fillText(isLeader ? '★ LEADER' : (isByzantine ? '⚠ FAULTY' : 'NODE'), x, y + 12);

      // Draw State Indicator Badge below node
      this.drawNodeStatusPill(node, x, y + 42);

      this.ctx.restore();
    }
  }

  drawNodeStatusPill(node, x, y) {
    let text = node.state;
    let bg = 'rgba(255, 255, 255, 0.05)';
    let color = '#94a3b8';

    if (node.isCommitted) {
      text = 'COMMITTED';
      bg = 'rgba(16, 185, 129, 0.2)';
      color = '#34d399';
    } else if (node.isPrepared) {
      text = 'PREPARED';
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
      p.progress += p.speed;

      if (p.progress >= 1) {
        this.activeParticles.splice(i, 1);
        continue;
      }

      const currentX = p.start.x + (p.end.x - p.start.x) * p.progress;
      const currentY = p.start.y + (p.end.y - p.start.y) * p.progress;
      const color = this.getPhaseColor(p.type);

      this.ctx.save();
      // Particle trail
      this.ctx.beginPath();
      this.ctx.arc(currentX, currentY, 6, 0, Math.PI * 2);
      this.ctx.fillStyle = color;
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = 10;
      this.ctx.fill();

      // Particle label badge
      this.ctx.font = 'bold 9px JetBrains Mono, monospace';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText(p.type, currentX + 8, currentY - 8);

      this.ctx.restore();
    }
  }
}
