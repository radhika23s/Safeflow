# 🎤 SafeFlow — Demo Day Presentation Script

> **Format:** [SAY] = speak it · [DO] = click/show it · [POINT] = gesture to screen.
> Total: **5 minutes** (with a 90-second speed run at the bottom and a judge Q&A armory).
> Practice twice end-to-end. Every claim below is verified working in this build.

---

## The 30-Second Pitch (memorize cold)

> "Banks spend billions catching **customer** fraud — but nobody catches **employee-assisted**
> fraud, because the AML team and the insider-risk team work in silos. SafeFlow is the first
> platform that fuses **who processed the money** into the financial-crime graph itself. A
> five-agent AI pipeline investigates, and — this is the part regulators care about — a fifth
> **critic agent** fact-checks the AI before a human ever sees it. Then a strict **maker-checker**
> governance model decides: the AI recommends, humans dispose, and every step lands in an
> append-only audit trail."

---

## ACT 0 · The Hook (0:00–0:30)

**[SAY]**
> "Under PMLA Section 12, every transfer above ₹50,000 must be reported. So crime syndicates
> move money in ₹48,500 slices. A machine-learning model scoring one of those transactions
> sees... nothing wrong. Daytime, normal amount. 8% risk. But it's Hop 3 of a funnel drain —
> and the person who *processed* it is an operations officer whose cousin's account is where
> the money ends up."

**[DO]** Open the landing page, scroll to the **Insider-Risk Intelligence** section.

**[SAY]**
> "That's the blind spot we kill. Here's how."

---

## ACT 1 · Why Three Roles? (0:30–1:15)

**[SAY]**
> "Before the tech — the governance, because in banking, *who may act* matters as much as
> *what's detected*. We implement the RBI **three lines of defense** in code, not in a policy PDF:"

**[POINT]** Sign-in page with the three quick-access buttons.

| Role | Who | Line of Defense | CAN do | CANNOT do |
| :--- | :--- | :--- | :--- | :--- |
| **Investigator** (Marcus) | 1st line — Maker | Triage cases, run AI investigations, **claim & escalate** insider alerts, dismiss false positives | Approve freezes, resolve alerts |
| **Compliance Manager** (Sarah) | 2nd line — Checker | **Sole authority**: approve account freezes, resolve/dismiss/reopen insider alerts | Be bypassed — no unilateral action by anyone |
| **Administrator** (Alex) | 3rd line — Auditor | Provision users, inspect the immutable audit trail | Make **any** case decision — auditors observe, they never touch |

**[SAY]**
> "Why? Because a single employee being able to freeze an account is itself a fraud vector —
> insider threat 101. So: the person who *finds* can never be the person who *approves*, and
> the person who *runs the system* can never decide a case. Every transition is role-gated in
> the backend — an investigator literally gets a 403 if they try to resolve an alert."

---

## ACT 2 · The Insider Evidence (1:15–2:15)

**[DO]** Sign in as **marcus.johnson@smarthorizon.ai** (`demo-password`) → sidebar **Insider Risk**.

**[SAY]**
> "Here's the insider workspace. Eight employees. The system flagged two — and notice the
> benign staff with normal, *declared* accounts generate zero alerts. We tested false positives
> explicitly: zero."

**[POINT]** **EMP-003 Sanjay Kulkarni**, Operations Officer.

**[SAY]**
> "Sanjay personally processed **four** sub-threshold transfers — right under the ₹50,000
> reporting line. Transfer number four? Paid **his cousin's account** — a related-party link
> he never declared. There's a 02:47 login outside his shift, and a manual limit override
> with no manager countersign."

**[DO]** Open case **FC-20260904-STR01** → scroll to the insider evidence panel.

**[SAY]**
> "And this is our rule: **no bare scores**. Every alert ships a typed evidence chain a
> reviewer can verify click by click — the account link, the processed transactions, the
> access event, the profile anomaly. If an auditor asks 'why is this employee flagged?', the
> answer is a list of facts, not a probability."

---

## ACT 3 · The Pipeline & the Critic Agent (2:15–3:30) — *the centerpiece*

**[DO]** On the case, click **Run AI Investigation**. Narrate while the agents execute.

**[SAY]**
> "Now the investigation itself. Five strictly segregated agents:
> **One — Score**: XGBoost with SHAP attributions, so we know *which features* drove the risk.
> **Two — Context**: a three-hop traversal of the transaction graph — this is where single-
> transaction blindness dies; the model finally sees the funnel.
> **Three — Reason**: Gemini writes the forensic narrative — with zero-knowledge PII masking,
> so customer data never leaves the bank. If the LLM is down, a fully-cited deterministic
> template keeps us at 100% uptime.
> **Four — Decision**: the recommended action, plus a freeze-priority matrix ranking downstream
> accounts by recoverable money, plus counterfactuals — 'what if this had run in business hours?'"

**[SAY — slow down here]**
> "**Five — the Validator. Our critic agent. This is what makes the AI trustworthy.** It
> independently cross-examines the pipeline's own output: every regulatory citation must
> resolve to a real clause in the regulations database — hallucinated citations fail. A report
> with zero citations fails outright. The cited clause must actually support the claim. And
> the decision must be consistent — no BLOCK on a low-risk score, no ALLOW on a critical one.
> If any check fails, the case is **forcibly routed to manager review**. The AI polices itself
> before humans have to."

**[POINT]** The **teal validated panel** in the workspace.

**[SAY]**
> "Green panel: the critic certified this investigation. It's persisted on the case, and it's
> regression-tested — including the failure cases."

---

## ACT 4 · Maker-Checker, Live (3:30–4:15)

**[SAY]**
> "The AI recommends ESCALATE. Now the human governance — watch who can do what."

**[DO]** As Marcus: **Claim** the insider alert (add a note) → **Escalate**.

**[SAY]**
> "Investigator: claim, escalate, dismiss false positives. That's it. Watch what happens if I
> try to resolve it as an investigator — the backend says no. 403."

**[DO]** Sign out → sign in as **sarah.chen@smarthorizon.ai** → resolve the escalated alert with a note.

**[SAY]**
> "Manager Sarah has the resolution authority — 4-eye principle, exactly how a bank's 2nd
> line works. And notice the case policies differ intelligently: pure external fraud cases
> recommend **BLOCK** — freeze and done. Insider cases recommend **ESCALATE** — because when
> the subject is your own employee, blocking a customer account fixes nothing. You need HR,
> STR filing, 2nd-line review. Human governance is *mandatory* exactly where it matters."

---

## ACT 5 · The Regulator's View + Close (4:15–5:00)

**[DO]** Open the **Audit Trail** page → **Insider Alert Lifecycle Trail**.

**[SAY]**
> "Every action either of us just took — claim, escalate, resolve — is here: actor, role,
> timestamp, notes, immutable. This is the page you show the regulator. And one click exports
> the FIU-IND STR dossier with the insider evidence embedded."

**[DO — bonus, if time]** Open **/bank**, fire 4 transfers of ₹10k–₹49,999.

**[SAY]**
> "And it's not just seeded data — live-fire: four sub-threshold transfers in the banking
> simulator. The graph engine attributes them via *processed_by* and correlates a fresh
> insider case in real time."

**[SAY — closing]**
> "SafeFlow: dual-risk detection that sees the network, an insider engine that names the
> employee, a critic agent that polices the AI, and three-lines-of-defense governance that
> regulators can audit line by line. **AI recommends. Humans decide. The trail remembers.**"

---

## ⚡ 90-Second Speed Run

1. *(0:00)* "Banks miss employee-assisted fraud — silos. We fused the employee graph into the crime graph." → Insider workspace: *"2 flagged, 3 undeclared accounts; benign staff: zero alerts."*
2. *(0:30)* Case STR01: "Officer processed 4 sub-₹50k splits, one paid his undeclared cousin's account — typed evidence, no bare scores."
3. *(1:00)* Run AI Investigation: "Five agents — score, context, reason, decision — and the **critic**: verifies citations against real statutes, forces manager review on any failure. Teal = certified."
4. *(1:30)* "Investigator escalates but **cannot** resolve — manager-only. Try it: 403." Claim → escalate → sign in as Sarah → resolve.
5. *(2:00)* Audit trail: "Every transition, actor, note — immutable. AI recommends, humans decide, the trail remembers."
6. *(2:30)* "55 tests: 100% recall on every attack pattern, zero false positives on benign staff."

---

## 🛡️ Judge Q&A Armory

**Q: "How do you know the AI isn't hallucinating?"**
> "That's the validator agent's whole job — citation existence against the regulations DB,
> claim-clause relevance via keyword overlap, decision-consistency. And we regression-test
> the failures: a fabricated citation, an uncited report, and a BLOCK-on-low-risk all fail."

**Q: "Why three roles? Isn't that overhead?"**
> "It's the RBI three-lines-of-defense model — and it's enforced server-side, not by hiding
> buttons. An investigator POSTing RESOLVE gets a 403; an invalid lifecycle transition gets a
> 409. Governance is code."

**Q: "What if the LLM is down?"**
> "A deterministic, fully-cited regulatory template takes over — same structure, same
> validator. 100% uptime; the demo you just saw actually ran on the fallback and still
> passed the critic."

**Q: "How do you handle false positives?"**
> "Tested, not claimed: benign control employees with declared accounts and in-shift activity
> produce zero alerts in the suite. Plus investigators can dismiss, with manager oversight."

**Q: "Is PII safe with the LLM?"**
> "Zero-knowledge masking — accounts and identifiers are masked before any external call and
> deterministically rehydrated after. There's a privacy audit block on every investigation."

**Q: "Real data?"**
> "Seeded forensic scenarios modeled on real PMLA structuring typology, plus a live simulator
> — Scenario C attributes fresh transactions to the compromised employee and correlates a new
> case on the fly."

**Q: "What's the tech?"**
> "FastAPI + SQLite (WAL) backend, XGBoost + TreeSHAP, NetworkX 3-hop graph engine, React 19
> + TanStack frontend, Express/Mongo double-entry ledger for the core-banking simulator.
> 55 backend tests green."

---

## 🧯 Failure Playbook

| Symptom | Say | Do |
| :--- | :--- | :--- |
| "Backend offline" banner / 401s | "Session hiccup — one second" | Sign out → sign in again (tokens die with backend restarts) |
| "Failed to fetch" on sign-in | — | Check the port — use **localhost:8080**; CORS now allows any port, but the tab must point at a live server |
| Backend not responding | — | `curl http://127.0.0.1:8000/health`; if dead: `cd backend && python -m uvicorn main:app --host 127.0.0.1 --port 8000` |
| Frontend down | — | `cd frontend && npm run dev` |
| Port 8000 busy (Errno 10048) | — | It's already running — don't start a duplicate |
| Demo DB looks reset | — | Open the insider cases once (re-correlates alerts), then re-drive claim→escalate→resolve via the UI |
| ₹ garbled in console | — | `set PYTHONIOENCODING=utf-8` |

**Nuclear option:** `cd backend && python reset_and_seed_db.py` → clean slate, then re-drive the lifecycle in ~60s.

---

## ✅ T-minus-10 Checklist

- [ ] Backend health: `curl http://127.0.0.1:8000/health` → `{"status":"ok"}`
- [ ] Frontend: `http://localhost:8080` loads
- [ ] Sign in as Marcus works
- [ ] Insider workspace shows 2 flagged employees
- [ ] Case FC-20260904-STR01 opens, Run AI Investigation → teal validator panel
- [ ] Audit trail shows the lifecycle story
- [ ] Sarah's login works (manager resolve)
- [ ] Browser zoom ≥ 110%, notifications silenced
