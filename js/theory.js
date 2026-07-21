/**
 * Theory & Interactive Calculator Controller
 * Explains BFT mathematical bounds N >= 3f + 1, PBFT phases, and student self-quiz.
 */

export class TheoryController {
  constructor() {
    this.initCalculator();
    this.initQuiz();
  }

  initCalculator() {
    const calcNInput = document.getElementById('calcNodes');
    const calcFInput = document.getElementById('calcFaults');
    
    if (!calcNInput || !calcFInput) return;

    const updateCalc = () => {
      const N = parseInt(calcNInput.value, 10);
      const F = parseInt(calcFInput.value, 10);

      const minNForF = 3 * F + 1;
      const maxFForN = Math.floor((N - 1) / 3);
      const isSatisfied = N >= (3 * F + 1);

      const resBox = document.getElementById('calcResultBox');
      const formulaText = document.getElementById('calcFormulaText');

      if (resBox && formulaText) {
        if (isSatisfied) {
          resBox.className = 'formula-box success';
          resBox.style.borderColor = '#10b981';
          resBox.style.background = 'rgba(16, 185, 129, 0.1)';
          resBox.style.color = '#34d399';
          formulaText.innerHTML = `✅ <b>Formula Satisfied:</b> N (${N}) ≥ 3f + 1 (${3*F + 1}).<br><small style="font-size:0.85rem; font-weight:normal; color:#cbd5e1">Safety & Liveness guaranteed with up to ${F} Byzantine node(s). Quorum size = 2f + 1 = <b>${2*F + 1}</b> votes.</small>`;
        } else {
          resBox.className = 'formula-box danger';
          resBox.style.borderColor = '#f43f5e';
          resBox.style.background = 'rgba(244, 63, 94, 0.1)';
          resBox.style.color = '#f87171';
          formulaText.innerHTML = `❌ <b>Consensus Vulnerable:</b> N (${N}) < 3f + 1 (${3*F + 1}).<br><small style="font-size:0.85rem; font-weight:normal; color:#fca5a5">To tolerate F=${F} malicious nodes, you need at least <b>N=${minNForF}</b> total nodes. With N=${N}, max tolerated F is <b>${maxFForN}</b>.</small>`;
        }
      }
    };

    calcNInput.addEventListener('input', () => {
      document.getElementById('calcNodesVal').textContent = calcNInput.value;
      updateCalc();
    });

    calcFInput.addEventListener('input', () => {
      document.getElementById('calcFaultsVal').textContent = calcFInput.value;
      updateCalc();
    });

    updateCalc();
  }

  initQuiz() {
    const quizForm = document.getElementById('bftQuizForm');
    if (!quizForm) return;

    const quizQuestions = [
      {
        id: 'q1',
        question: '1. 2台の障害ノード（F=2）が存在するネットワークで合意を形成するために必要な最小ノード数 N は？',
        options: [
          { text: '5台', correct: false },
          { text: '6台', correct: false },
          { text: '7台 (3×2 + 1)', correct: true },
          { text: '9台', correct: false }
        ]
      },
      {
        id: 'q2',
        question: '2. PBFTにおいて、各ノードがクオラム（合意成立に必要な賛成数）に達するために必要な同等メッセージ数は？',
        options: [
          { text: 'f + 1 個', correct: false },
          { text: '2f + 1 個', correct: true },
          { text: '3f + 1 個', correct: false },
          { text: '全員 (N 個)', correct: false }
        ]
      },
      {
        id: 'q3',
        question: '3. ビザンチン障害（Byzantine Fault）に含まれるノードの挙動として【誤っているもの】はどれ？',
        options: [
          { text: 'メッセージを途中で送信せず沈黙する（Crash Fault）', correct: false },
          { text: '相手によって異なる改ざんメッセージを送る（Split vote）', correct: false },
          { text: '暗号署名を不正に複製・盗聴なしに解読する', correct: true },
          { text: '不正なトランザクションダイジェストを送信する', correct: false }
        ]
      }
    ];

    let html = '';
    quizQuestions.forEach((q, idx) => {
      html += `
        <div style="margin-bottom: 1.25rem; background: rgba(0,0,0,0.2); padding: 1rem; border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.05);">
          <p style="font-weight: 600; color: #fff; margin-bottom: 0.75rem;">${q.question}</p>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
      `;
      q.options.forEach((opt, oIdx) => {
        html += `
          <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; color: var(--text-muted); cursor: pointer;">
            <input type="radio" name="${q.id}" value="${oIdx}">
            <span>${opt.text}</span>
          </label>
        `;
      });
      html += `</div></div>`;
    });

    html += `<button type="button" id="btnSubmitQuiz" class="btn-preset active" style="padding: 0.75rem 1.5rem; font-size: 0.9rem; font-weight: 600;">採点する (Check Answers)</button>`;
    html += `<div id="quizScoreResult" style="margin-top: 1rem; font-weight: 600;"></div>`;

    quizForm.innerHTML = html;

    document.getElementById('btnSubmitQuiz')?.addEventListener('click', () => {
      let score = 0;
      quizQuestions.forEach((q) => {
        const selected = quizForm.querySelector(`input[name="${q.id}"]:checked`);
        if (selected) {
          const val = parseInt(selected.value, 10);
          if (q.options[val].correct) score++;
        }
      });

      const scoreBox = document.getElementById('quizScoreResult');
      if (score === quizQuestions.length) {
        scoreBox.style.color = '#34d399';
        scoreBox.innerHTML = `🎉 満点です！ (${score} / ${quizQuestions.length}) BFTの基本理論を理解できています！`;
      } else {
        scoreBox.style.color = '#fbbf24';
        scoreBox.innerHTML = `正解数: ${score} / ${quizQuestions.length}。もう一度解説を読み直してみましょう！`;
      }
    });
  }
}
