
/* =========================================
   SENTINELPAY - FRONTEND BACKEND CONNECTION
========================================= */

const API_BASE = "https://sentinelpay-9xnd.onrender.com";

let allTransactions = [];
let transactionChart = null;


/* =========================================
   COMMON HELPER FUNCTIONS
========================================= */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}


function formatAmount(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number.toFixed(2)
        : "0.00";
}


function formatDate(value) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return escapeHTML(value);
    }

    return date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
    });
}


function showResult(elementId, message, type = "") {
    const element = document.getElementById(elementId);

    if (!element) return;

    element.className = "result-message";

    if (type) {
        element.classList.add(type);
    }

    element.textContent = message;
}


function apiRequest(endpoint, options = {}) {
    return fetch(API_BASE + endpoint, options)
        .then(async response => {
            const text = await response.text();

            let data;

            try {
                data = text ? JSON.parse(text) : {};
            } catch {
                data = { detail: text };
            }

            if (!response.ok) {
                throw new Error(
                    data.detail || data.message ||
                    "Backend request failed."
                );
            }

            return data;
        })
        .catch(error => {
            if (error instanceof TypeError) {
                throw new Error(
                    "Cannot connect to backend. Make sure FastAPI is running."
                );
            }

            throw error;
        });
}


function getStatusBadge(status) {
    const value = String(status || "").toUpperCase();

    if (value === "APPROVED" || value === "SUCCESS") {
        return '<span class="status-approved">' +
            escapeHTML(value) + '</span>';
    }

    if (value === "BLOCKED") {
        return '<span class="status-blocked">BLOCKED</span>';
    }

    return '<span class="status-pending">' +
        escapeHTML(value || "UNKNOWN") + '</span>';
}


function getDetectionLabel(method) {
    const value = String(method || "UNKNOWN").toUpperCase();

    if (value === "AI") return "AI";
    if (value.includes("KEYWORD")) return "KEYWORD";
    if (value === "RULE") return "RULE";

    return value;
}


function getRiskLabel(score) {
    if (score === null || score === undefined) {
        return "N/A";
    }

    const number = Number(score);

    if (!Number.isFinite(number)) return "N/A";

    return number + "/100";
}


function getEventLabel(eventType) {
    return String(eventType || "PAYMENT").replace(/_/g, " ");
}


/* =========================================
   RECENT TRANSACTION TABLE
   OVERVIEW PAGE - FIVE COLUMNS
========================================= */

function renderTransactionRows(transactions, elementId) {
    const tableBody = document.getElementById(elementId);

    if (!tableBody) return;

    if (!transactions.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5">No recorded transactions found.</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = transactions.map(transaction => `
        <tr>
            <td>#${escapeHTML(transaction.id)}</td>
            <td>${escapeHTML(transaction.agent_id)}</td>
            <td>₹${formatAmount(transaction.amount)}</td>
            <td>${getStatusBadge(transaction.status)}</td>
            <td>${escapeHTML(transaction.reason || "No reason provided")}</td>
        </tr>
    `).join("");
}


/* =========================================
   DETAILED AUDIT TABLE
   AUDIT PAGE - NINE COLUMNS
========================================= */

function renderAuditRows(transactions) {
    const tableBody = document.getElementById("auditLogList");

    if (!tableBody) return;

    if (!transactions.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9">No audit records found.</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = transactions.map(transaction => `
        <tr>
            <td>#${escapeHTML(transaction.id)}</td>

            <td>${escapeHTML(transaction.agent_id)}</td>

            <td>₹${formatAmount(transaction.amount)}</td>

            <td>${getStatusBadge(transaction.status)}</td>

            <td>${escapeHTML(
                getEventLabel(transaction.event_type)
            )}</td>

            <td>${escapeHTML(
                getRiskLabel(transaction.risk_score)
            )}</td>

            <td>${escapeHTML(
                getDetectionLabel(transaction.detection_method)
            )}</td>

            <td>${formatDate(transaction.created_at)}</td>

            <td>${escapeHTML(
                transaction.reason || "No reason provided"
            )}</td>
        </tr>
    `).join("");
}


/* =========================================
   OVERVIEW - LOAD TRANSACTIONS
========================================= */

async function loadOverviewTransactions() {
    const transactions = await apiRequest("/transactions");

    allTransactions = Array.isArray(transactions)
        ? transactions
        : [];

    const total = allTransactions.length;

    const approved = allTransactions.filter(item =>
        ["APPROVED", "SUCCESS"].includes(
            String(item.status).toUpperCase()
        )
    ).length;

    const blocked = allTransactions.filter(item =>
        String(item.status).toUpperCase() === "BLOCKED"
    ).length;

    const totalElement =
        document.getElementById("totalTransactions");

    const approvedElement =
        document.getElementById("approvedPayments");

    const blockedElement =
        document.getElementById("blockedPayments");

    if (totalElement) totalElement.textContent = total;
    if (approvedElement) approvedElement.textContent = approved;
    if (blockedElement) blockedElement.textContent = blocked;

    const recentTransactions = [...allTransactions]
        .sort((a, b) => Number(b.id) - Number(a.id))
        .slice(0, 5);

    renderTransactionRows(
        recentTransactions,
        "transactionList"
    );

    updateTransactionChart(approved, blocked);
}


/* =========================================
   OVERVIEW - TRANSACTION CHART
========================================= */

function updateTransactionChart(approved, blocked) {
    const canvas = document.getElementById("transactionChart");

    if (!canvas || typeof Chart === "undefined") return;

    if (transactionChart) {
        transactionChart.data.datasets[0].data = [
            approved,
            blocked
        ];

        transactionChart.update();
        return;
    }

    transactionChart = new Chart(canvas, {
        type: "bar",

        data: {
            labels: ["Approved", "Blocked"],

            datasets: [{
                label: "Recorded transactions",
                data: [approved, blocked],
                backgroundColor: ["#E98A43", "#C75C50"],
                borderRadius: 9,
                borderSkipped: false,
                barThickness: 48
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    display: false
                },

                tooltip: {
                    backgroundColor: "#30231E",
                    padding: 12
                }
            },

            scales: {
                x: {
                    grid: {
                        display: false
                    },

                    ticks: {
                        color: "#927E70"
                    }
                },

                y: {
                    beginAtZero: true,

                    ticks: {
                        precision: 0,
                        color: "#927E70"
                    },

                    grid: {
                        color: "#F0E7DE"
                    }
                }
            }
        }
    });
}


/* =========================================
   OVERVIEW - WALLET STATUS
========================================= */

async function loadOverviewWallet() {
    const wallet = await apiRequest(
        "/wallet-status/agent_01"
    );

    const frozen = Boolean(wallet.is_frozen);

    const statusElement =
        document.getElementById("overviewWalletStatus");

    const messageElement =
        document.getElementById("overviewSecurityMessage");

    if (statusElement) {
        statusElement.textContent =
            frozen ? "FROZEN" : "ACTIVE";
    }

    if (messageElement) {
        messageElement.textContent = frozen
            ? "Agent agent_01 is frozen. Reason: " +
              (wallet.freeze_reason || "Security review required.")
            : "Agent agent_01 is currently active and monitored.";
    }
}


/* =========================================
   OVERVIEW - REFRESH
========================================= */

async function refreshOverview() {
    try {
        await loadOverviewTransactions();
    } catch (error) {
        console.error("Overview transactions:", error);

        const table = document.getElementById("transactionList");

        if (table) {
            table.innerHTML = `
                <tr>
                    <td colspan="5">Unable to load transactions.</td>
                </tr>
            `;
        }
    }

    try {
        await loadOverviewWallet();
    } catch (error) {
        console.error("Overview wallet:", error);

        const status =
            document.getElementById("overviewWalletStatus");

        const message =
            document.getElementById("overviewSecurityMessage");

        if (status) status.textContent = "ERROR";

        if (message) {
            message.textContent = "Unable to load wallet status.";
        }
    }
}

window.refreshOverview = refreshOverview;


/* =========================================
   RESULT DETAILS
========================================= */

function buildVerificationMessage(result, approved) {
    const risk = getRiskLabel(result.risk_score);
    const detection = getDetectionLabel(result.detection_method);

    if (approved) {
        return (
            "PAYMENT APPROVED. " +
            "Risk Score: " + risk +
            ". Detection: " + detection +
            ". " +
            (result.remaining_allowance !== undefined
                ? "Remaining allowance: ₹" +
                  formatAmount(result.remaining_allowance)
                : "")
        );
    }

    return (
        "PAYMENT BLOCKED. " +
        (result.reason || "Request denied.") +
        " Risk Score: " + risk +
        ". Detection: " + detection
    );
}


/* =========================================
   ALLOWANCE MANAGEMENT
========================================= */

const allowanceForm =
    document.getElementById("allowanceForm");

if (allowanceForm) {
    allowanceForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        const agentId =
            document.getElementById("allowanceAgent").value.trim();

        const amount =
            document.getElementById("paymentAmount").value;

        const prompt =
            document.getElementById("paymentPrompt").value.trim();

        if (!agentId || !amount || Number(amount) <= 0) {
            showResult(
                "allowanceResult",
                "Please enter a valid agent ID and payment amount.",
                "error"
            );
            return;
        }

        const button =
            this.querySelector("button[type='submit']");

        button.disabled = true;
        button.textContent = "Verifying...";

        const params = new URLSearchParams({
            agent_id: agentId,
            amount: amount,
            prompt_text: prompt
        });

        try {
            const result = await apiRequest(
                "/verify-payment?" + params.toString(),
                { method: "POST" }
            );

            const approved = result.status === "APPROVED";

            showResult(
                "allowanceResult",
                buildVerificationMessage(result, approved),
                approved ? "success" : "error"
            );

            await refreshOverview();

        } catch (error) {
            showResult(
                "allowanceResult",
                error.message,
                "error"
            );
        } finally {
            button.disabled = false;

            button.innerHTML =
                '<i class="fa-solid fa-shield-check"></i> Verify Payment';
        }
    });
}


/* =========================================
   PROMPT SCANNER
========================================= */

const scannerForm =
    document.getElementById("scannerForm");

if (scannerForm) {
    scannerForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        const agentId =
            document.getElementById("scannerAgent").value.trim();

        const prompt =
            document.getElementById("scannerPrompt").value.trim();

        if (!agentId || !prompt) {
            showResult(
                "scannerResult",
                "Please enter the agent ID and prompt.",
                "error"
            );
            return;
        }

        const button =
            this.querySelector("button[type='submit']");

        button.disabled = true;
        button.textContent = "Scanning...";

        const params = new URLSearchParams({
            agent_id: agentId,
            amount: "0",
            prompt_text: prompt
        });

        try {
            const result = await apiRequest(
                "/verify-payment?" + params.toString(),
                { method: "POST" }
            );

            const approved = result.status === "APPROVED";

            const message = approved
                ? "PROMPT PASSED THE BACKEND SECURITY CHECKS. "
                : "SECURITY ALERT: ";

            showResult(
                "scannerResult",
                message +
                (result.reason || "") +
                " Risk Score: " +
                getRiskLabel(result.risk_score) +
                ". Detection Method: " +
                getDetectionLabel(result.detection_method) +
                (result.wallet_frozen
                    ? ". Wallet has been frozen."
                    : ""),
                approved ? "success" : "error"
            );

            await refreshOverview();

        } catch (error) {
            showResult(
                "scannerResult",
                error.message,
                "error"
            );
        } finally {
            button.disabled = false;

            button.innerHTML =
                '<i class="fa-solid fa-radar"></i> Scan for Threats';
        }
    });
}


/* =========================================
   WALLET SECURITY
========================================= */

const walletStatusForm =
    document.getElementById("walletStatusForm");

if (walletStatusForm) {
    walletStatusForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        const agentId =
            document.getElementById("statusAgent").value.trim();

        if (!agentId) {
            document.getElementById("walletReason").textContent =
                "Please enter an agent ID.";
            return;
        }

        const button =
            this.querySelector("button[type='submit']");

        button.disabled = true;
        button.textContent = "Checking...";

        try {
            const wallet = await apiRequest(
                "/wallet-status/" + encodeURIComponent(agentId)
            );

            const frozen = Boolean(wallet.is_frozen);

            document.getElementById("walletStatusValue").textContent =
                frozen ? "FROZEN" : "ACTIVE";

            document.getElementById("walletAllowance").textContent =
                formatAmount(wallet.allowance);

            document.getElementById("walletSpent").textContent =
                formatAmount(wallet.spent);

            document.getElementById("walletRemaining").textContent =
                formatAmount(wallet.remaining);

            document.getElementById("walletReason").textContent =
                frozen
                    ? "WALLET FROZEN. Reason: " +
                      (wallet.freeze_reason ||
                       "No freeze reason provided by backend.")
                    : "WALLET ACTIVE. No current freeze reason.";

        } catch (error) {
            document.getElementById("walletReason").textContent =
                error.message;
        } finally {
            button.disabled = false;

            button.innerHTML =
                '<i class="fa-solid fa-magnifying-glass"></i> Check Status';
        }
    });
}


/* =========================================
   HUMAN OVERRIDE
========================================= */

const overrideForm =
    document.getElementById("overrideForm");

if (overrideForm) {
    overrideForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        const agentId =
            document.getElementById("overrideAgent").value.trim();

        if (!agentId) {
            showResult(
                "overrideResult",
                "Please enter an agent ID.",
                "error"
            );
            return;
        }

        const button =
            this.querySelector("button[type='submit']");

        button.disabled = true;
        button.textContent = "Restoring access...";

        const params = new URLSearchParams({
            agent_id: agentId
        });

        try {
            const result = await apiRequest(
                "/unfreeze-wallet?" + params.toString(),
                { method: "POST" }
            );

            showResult(
                "overrideResult",
                result.message || "Wallet unfreeze request completed.",
                "success"
            );

            await refreshOverview();

        } catch (error) {
            showResult(
                "overrideResult",
                error.message,
                "error"
            );
        } finally {
            button.disabled = false;

            button.innerHTML =
                '<i class="fa-solid fa-unlock"></i> Unfreeze Wallet';
        }
    });
}


/* =========================================
   AUDIT LOGS
========================================= */

async function loadAuditLogs() {
    const tableBody =
        document.getElementById("auditLogList");

    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="9">Loading audit records...</td>
        </tr>
    `;

    try {
        const transactions = await apiRequest("/transactions");

        allTransactions = Array.isArray(transactions)
            ? transactions
            : [];

        renderFilteredAuditLogs();

    } catch (error) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9">${escapeHTML(error.message)}</td>
            </tr>
        `;
    }
}

window.loadAuditLogs = loadAuditLogs;


function renderFilteredAuditLogs() {
    const filterElement =
        document.getElementById("auditAgent");

    if (!filterElement) return;

    const filter = filterElement.value
        .trim()
        .toLowerCase();

    const filteredTransactions = allTransactions
        .filter(transaction => {
            return !filter ||
                String(transaction.agent_id || "")
                    .toLowerCase()
                    .includes(filter);
        })
        .sort((a, b) => Number(b.id) - Number(a.id));

    renderAuditRows(filteredTransactions);
}


/* =========================================
   AUDIT REFRESH AND FILTER
========================================= */

const refreshAuditButton =
    document.getElementById("refreshAudit");

if (refreshAuditButton) {
    refreshAuditButton.addEventListener(
        "click",
        loadAuditLogs
    );
}


const auditFilter =
    document.getElementById("auditAgent");

if (auditFilter) {
    auditFilter.addEventListener(
        "input",
        renderFilteredAuditLogs
    );
}


/* =========================================
   INITIAL DASHBOARD LOAD
========================================= */

document.addEventListener("DOMContentLoaded", function() {
    refreshOverview();
});
