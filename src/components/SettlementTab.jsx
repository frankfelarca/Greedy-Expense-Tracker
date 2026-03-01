import { useState, useMemo, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion";
import {
  setQrCode,
  setPaymentInfo,
  markSettlementPaid,
  unmarkSettlementPaid,
  setProofOfPayment,
  removeProofOfPayment,
  declineProofOfPayment,
} from "../store/tripSlice";
import { toast } from "../store/toastSlice";
import { formatNum } from "../utils/helpers";
import { computeBalances, computeSettlements } from "../utils/settlements";
import {
  QR_TYPES,
  MAX_QR_SIZE,
  WALLET_TYPES,
  CAT_LABELS,
  CAT_ICONS,
} from "../utils/constants";
import {
  uploadQrCode,
  deleteQrCode,
  getQrUrl,
  uploadProofOfPayment,
  deleteProofOfPayment,
  getProofUrl,
} from "../utils/sync";
import { Card, CardTitle, Btn, Modal, Spinner } from "./UI";

export default function SettlementTab({ currentUser }) {
  const dispatch = useDispatch();
  const {
    expenses,
    travelers,
    qrCodes = {},
    paymentInfo = {},
    paidSettlements = {},
    paidExpenses = {},
    proofOfPayment = {},
    partialPayments = {},
    dpCollections = [],
    hotelCostPerHead,
    hotelNights,
    hotelParkingSlots,
    hotelParkingCost,
    numberOfCars = 0,
  } = useSelector((s) => s.trip);
  const syncConfig = useSelector((s) => s.sync);
  const [qrModal, setQrModal] = useState(null);
  const [qrWallet, setQrWallet] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [uploadKey, setUploadKey] = useState(0);
  const [proofUploading, setProofUploading] = useState(null);
  const [proofModal, setProofModal] = useState(null);
  const [declineModal, setDeclineModal] = useState(null);
  const [declineReason, setDeclineReason] = useState("");
  const [declineAmount, setDeclineAmount] = useState("");
  const [breakdownFilter, setBreakdownFilter] = useState("mine");
  const [breakdownOpen, setBreakdownOpen] = useState(() => window.innerWidth >= 641);
  const savedInfo = paymentInfo[currentUser] || {
    gcash: "",
    maya: "",
    maribank: "",
  };
  const savedCustom = savedInfo.custom || null;
  const [infoForm, setInfoForm] = useState({
    gcash: savedInfo.gcash || "",
    maya: savedInfo.maya || "",
    maribank: savedInfo.maribank || "",
  });
  const [customForm, setCustomForm] = useState(
    savedCustom ? { label: savedCustom.label || "", number: savedCustom.number || "" } : null,
  );
  const [infoErrors, setInfoErrors] = useState({});
  const customDirty = (() => {
    if (!customForm && !savedCustom) return false;
    if (!customForm && savedCustom) return true;
    if (customForm && !savedCustom) return true;
    return customForm.label !== (savedCustom?.label || "") || customForm.number !== (savedCustom?.number || "");
  })();
  const infoDirty =
    infoForm.gcash !== (savedInfo.gcash || "") ||
    infoForm.maya !== (savedInfo.maya || "") ||
    infoForm.maribank !== (savedInfo.maribank || "") ||
    customDirty;

  useEffect(() => {
    if (!infoDirty) {
      setInfoForm({
        gcash: savedInfo.gcash || "",
        maya: savedInfo.maya || "",
        maribank: savedInfo.maribank || "",
      });
      setCustomForm(
        savedCustom ? { label: savedCustom.label || "", number: savedCustom.number || "" } : null,
      );
    }
  }, [savedInfo.gcash, savedInfo.maya, savedInfo.maribank, savedCustom?.label, savedCustom?.number, infoDirty, savedCustom]);

  const { balances } = useMemo(
    () => computeBalances(expenses, travelers, paidExpenses, numberOfCars),
    [expenses, travelers, paidExpenses, numberOfCars],
  );

  const travelerNames = useMemo(
    () => new Set(travelers.map((t) => t.name)),
    [travelers],
  );
  const activeDpCollections = useMemo(
    () => dpCollections.filter((d) => travelerNames.has(d.from)),
    [dpCollections, travelerNames],
  );

  const hotelCost = useMemo(
    () =>
      hotelCostPerHead * travelers.length * hotelNights +
      hotelParkingSlots * hotelParkingCost * hotelNights,
    [
      hotelCostPerHead,
      travelers.length,
      hotelNights,
      hotelParkingSlots,
      hotelParkingCost,
    ],
  );
  const totalCollected = useMemo(
    () => activeDpCollections.reduce((s, d) => s + d.amount, 0),
    [activeDpCollections],
  );
  const totalExcess = totalCollected - hotelCost;

  const excessByCollector = useMemo(() => {
    const sharePerPerson =
      travelers.length > 0 ? hotelCost / travelers.length : 0;
    const byCollector = {};
    activeDpCollections.forEach((d) => {
      if (!d.collectedBy) return;
      if (!byCollector[d.collectedBy]) byCollector[d.collectedBy] = {};
      byCollector[d.collectedBy][d.from] =
        (byCollector[d.collectedBy][d.from] || 0) + d.amount;
    });
    const result = [];
    Object.entries(byCollector).forEach(([collector, perPerson]) => {
      const persons = [];
      let collectorTotal = 0;
      let collectorHotelShare = 0;
      Object.entries(perPerson).forEach(([person, collected]) => {
        const excess = collected - sharePerPerson;
        collectorTotal += collected;
        collectorHotelShare += sharePerPerson;
        persons.push({ person, collected, hotelShare: sharePerPerson, excess });
      });
      const totalExcessForCollector = collectorTotal - collectorHotelShare;
      if (Math.abs(totalExcessForCollector) > 0.01) {
        result.push({
          collector,
          persons,
          totalCollected: collectorTotal,
          totalHotelShare: collectorHotelShare,
          totalExcess: totalExcessForCollector,
        });
      }
    });
    return result;
  }, [activeDpCollections, travelers, hotelCost]);

  const totalSettlements = useMemo(
    () => computeSettlements(balances),
    [balances],
  );

  const combinedSettlements = useMemo(() => {
    const netMap = {};
    const addFlow = (from, to, amount) => {
      if (Math.abs(amount) < 0.01 || from === to) return;
      const [a, b] = [from, to].sort();
      const k = a + "__" + b;
      if (!netMap[k]) netMap[k] = { a, b, net: 0 };
      netMap[k].net += from === a ? amount : -amount;
    };
    totalSettlements.forEach((s) => addFlow(s.from, s.to, s.amount));
    excessByCollector.forEach((e) => {
      e.persons.forEach((p) => {
        if (Math.abs(p.excess) > 0.01) addFlow(e.collector, p.person, p.excess);
      });
    });
    return Object.values(netMap)
      .filter((v) => Math.abs(v.net) > 0.01)
      .map((v) => ({
        from: v.net > 0 ? v.a : v.b,
        to: v.net > 0 ? v.b : v.a,
        amount: Math.abs(v.net),
      }));
  }, [totalSettlements, excessByCollector]);

  const sKey = (s) => `${s.from}__${s.to}`;

  const expensesByPair = useMemo(() => {
    const map = {};
    expenses.forEach((exp) => {
      const isPaid = !!paidExpenses[exp.id];
      const share =
        Math.round((exp.amount / exp.splitAmong.length) * 100) / 100;
      exp.splitAmong.forEach((name) => {
        if (name !== exp.paidBy) {
          const k = `${name}__${exp.paidBy}`;
          if (!map[k]) map[k] = { from: name, to: exp.paidBy, expenses: [] };
          map[k].expenses.push({ ...exp, owedAmount: share, isPaid });
        }
      });
    });
    return Object.values(map);
  }, [expenses, paidExpenses]);

  const isUserSettlement = (s) =>
    currentUser && (s.from === currentUser || s.to === currentUser);
  const userSettlements = combinedSettlements.filter(isUserSettlement);
  const otherSettlements = combinedSettlements.filter(
    (s) => !isUserSettlement(s),
  );

  const userCombinedBalance = useMemo(() => {
    if (!currentUser) return null;
    let net = 0;
    combinedSettlements.forEach((s) => {
      if (s.to === currentUser) net += s.amount;
      if (s.from === currentUser) net -= s.amount;
    });
    return net;
  }, [currentUser, combinedSettlements]);
  const userOwes = userCombinedBalance !== null && userCombinedBalance < -0.01;

  const { settledToYou, settledByYou } = useMemo(() => {
    if (!currentUser) return { settledToYou: 0, settledByYou: 0 };
    let toYou = 0;
    let byYou = 0;
    combinedSettlements.forEach((s) => {
      const key = sKey(s);
      if (!paidSettlements[key]) return;
      if (s.to === currentUser) toYou += s.amount;
      if (s.from === currentUser) byYou += s.amount;
    });
    return { settledToYou: toYou, settledByYou: byYou };
  }, [currentUser, combinedSettlements, paidSettlements]);

  const userRemainingBalance = useMemo(() => {
    if (!currentUser) return null;
    let net = 0;
    combinedSettlements.forEach((s) => {
      const key = sKey(s);
      if (paidSettlements[key]) return;
      if (s.to === currentUser) net += s.amount;
      if (s.from === currentUser) net -= s.amount;
    });
    return net;
  }, [currentUser, combinedSettlements, paidSettlements]);
  const hasPaidSettlements = Object.keys(paidSettlements).length > 0;
  const totalDiffers =
    hasPaidSettlements &&
    Math.abs(userCombinedBalance - userRemainingBalance) > 0.01;

  const userDpExcess = useMemo(() => {
    if (!currentUser) return 0;
    let net = 0;
    excessByCollector.forEach((e) => {
      if (e.collector === currentUser) net -= e.totalExcess;
      e.persons.forEach((p) => {
        if (p.person === currentUser) net += p.excess;
      });
    });
    return net;
  }, [currentUser, excessByCollector]);

  const userPaidExpenses = useMemo(() => {
    if (!currentUser) return [];
    const ids = Object.keys(paidExpenses);
    if (ids.length === 0) return [];
    return expenses
      .filter(
        (exp) =>
          paidExpenses[exp.id] &&
          (exp.paidBy === currentUser || exp.splitAmong.includes(currentUser)),
      )
      .map((exp) => {
        const perPerson =
          Math.round((exp.amount / exp.splitAmong.length) * 100) / 100;
        const share = exp.splitAmong.includes(currentUser) ? perPerson : 0;
        return { ...exp, share, paidInfo: paidExpenses[exp.id] };
      });
  }, [currentUser, expenses, paidExpenses]);

  const totalPaidExpensesShare = useMemo(
    () => userPaidExpenses.reduce((s, e) => s + e.share, 0),
    [userPaidExpenses],
  );

  const totalPaidExpensesAmount = useMemo(
    () => userPaidExpenses.reduce((s, e) => s + e.amount, 0),
    [userPaidExpenses],
  );

  const getUserQr = (name) => {
    const q = qrCodes[name];
    if (!q) return {};
    if (typeof q === "string") return { gcash: q };
    return q;
  };

  const handleQrUpload = async (walletKey, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!QR_TYPES.includes(file.type)) {
      dispatch(toast("Only JPG, PNG, or WebP images allowed.", "error"));
      return;
    }
    if (file.size > MAX_QR_SIZE) {
      dispatch(toast("Image too large. Max 10MB.", "error"));
      return;
    }
    setUploading(walletKey);
    try {
      const userQr = getUserQr(currentUser);
      const oldPath = userQr[walletKey];
      const blobPath = await uploadQrCode(
        syncConfig,
        `${currentUser}_${walletKey}`,
        file,
      );
      if (oldPath && oldPath !== blobPath) {
        try {
          await deleteQrCode(syncConfig, oldPath);
        } catch { /* ignored */ }
      }
      dispatch(
        setQrCode({ name: currentUser, type: walletKey, path: blobPath }),
      );
      dispatch(
        toast(
          `${WALLET_TYPES.find((w) => w.key === walletKey)?.label} QR uploaded!`,
        ),
      );
    } catch (err) {
      console.error("QR upload error:", err);
      dispatch(toast("QR upload failed.", "error"));
    }
    setUploading(null);
    setUploadKey((k) => k + 1);
  };

  const handleRemoveQr = async (walletKey) => {
    const userQr = getUserQr(currentUser);
    const oldPath = userQr[walletKey];
    dispatch(setQrCode({ name: currentUser, type: walletKey, path: null }));
    setUploadKey((k) => k + 1);
    if (oldPath) {
      try {
        await deleteQrCode(syncConfig, oldPath);
      } catch { /* ignored */ }
    }
    dispatch(toast("QR code removed."));
  };

  const handleInfoChange = (field, value) => {
    const cleaned = value.replace(/[^0-9]/g, "").slice(0, 13);
    setInfoForm((prev) => ({ ...prev, [field]: cleaned }));
    setInfoErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleInfoSave = () => {
    const errs = {};
    if (
      infoForm.gcash &&
      (infoForm.gcash.length !== 11 || !infoForm.gcash.startsWith("09"))
    )
      errs.gcash = "Must be 11 digits starting with 09";
    if (
      infoForm.maya &&
      (infoForm.maya.length !== 11 || !infoForm.maya.startsWith("09"))
    )
      errs.maya = "Must be 11 digits starting with 09";
    if (infoForm.maribank && infoForm.maribank.length < 10)
      errs.maribank = "Must be at least 10 digits";
    if (customForm && customForm.label && !customForm.number)
      errs.customNumber = "Account number is required";
    if (customForm && customForm.number && !customForm.label)
      errs.customLabel = "Bank/wallet name is required";
    setInfoErrors(errs);
    if (Object.keys(errs).length > 0) {
      dispatch(toast("Please fix the errors.", "error"));
      return;
    }
    const info = { ...infoForm };
    if (customForm && customForm.label && customForm.number) {
      info.custom = { label: customForm.label, number: customForm.number };
    } else {
      info.custom = null;
    }
    dispatch(setPaymentInfo({ name: currentUser, info }));
    dispatch(toast("Payment info saved!"));
  };

  const hasPaymentDetails = (name) => {
    const info = paymentInfo[name] || {};
    const qr = getUserQr(name);
    return !!(
      qr.gcash ||
      qr.maya ||
      qr.maribank ||
      qr.custom ||
      info.gcash ||
      info.maya ||
      info.maribank ||
      info.custom?.number
    );
  };

  const nameClick = (name) => {
    if (hasPaymentDetails(name)) {
      const qr = getUserQr(name);
      const firstWithQr = WALLET_TYPES.find((w) => qr[w.key]);
      setQrWallet(firstWithQr ? firstWithQr.key : null);
      setQrModal(name);
    }
  };

  const resolveQrUrl = (path) => (path ? getQrUrl(syncConfig, path) : null);

  const handleToggleSettlement = (s) => {
    const key = sKey(s);
    const date = new Date().toISOString().slice(0, 10);
    if (paidSettlements[key]) {
      dispatch(unmarkSettlementPaid(key));
      dispatch(toast("Settlement unmarked."));
    } else {
      dispatch(markSettlementPaid({ key, confirmedBy: currentUser, date }));
      dispatch(toast("Settlement marked as paid!"));
    }
  };

  const handleProofUpload = async (settlementKey, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofUploading(settlementKey);
    try {
      const oldProof = proofOfPayment[settlementKey];
      if (oldProof?.path) {
        try {
          await deleteProofOfPayment(syncConfig, oldProof.path);
        } catch { /* ignored */ }
      }
      const blobPath = await uploadProofOfPayment(
        syncConfig,
        settlementKey,
        file,
      );
      dispatch(
        setProofOfPayment({
          settlementKey,
          path: blobPath,
          uploadedBy: currentUser,
        }),
      );
      dispatch(toast("Proof of payment uploaded!"));
    } catch (err) {
      dispatch(toast(err.message || "Upload failed.", "error"));
    }
    setProofUploading(null);
  };

  const handleProofRemove = async (settlementKey) => {
    const proof = proofOfPayment[settlementKey];
    if (proof?.path) {
      try {
        await deleteProofOfPayment(syncConfig, proof.path);
      } catch { /* ignored */ }
    }
    dispatch(removeProofOfPayment(settlementKey));
    dispatch(toast("Proof removed."));
  };

  const handleProofDecline = async (settlementKey, reason, amountReceived) => {
    const proof = proofOfPayment[settlementKey];
    if (proof?.path) {
      try {
        await deleteProofOfPayment(syncConfig, proof.path);
      } catch { /* ignored */ }
    }
    dispatch(
      declineProofOfPayment({ settlementKey, declinedBy: currentUser, reason, amountReceived: amountReceived || 0 }),
    );
    dispatch(toast(amountReceived > 0 ? `Proof declined. Received \u20B1${formatNum(amountReceived)}.` : "Proof declined."));
  };

  return (
    <>
      <div className="settlement-grid">
      <div className="settlement-col">
      <Card>
        <CardTitle icon="&#129309;" gradient="var(--gradient4)">
          Who Owes Whom
        </CardTitle>

        {currentUser &&
          userCombinedBalance !== null &&
          Math.abs(userCombinedBalance) > 0.01 && (
            <div
              style={{
                borderRadius: 14,
                marginBottom: 16,
                overflow: "hidden",
                border: `1px solid ${Math.abs(userRemainingBalance) < 0.01 ? "rgba(67,233,123,0.25)" : userOwes ? "rgba(255,107,107,0.2)" : "rgba(67,233,123,0.25)"}`,
              }}
            >
              {/* Main status */}
              <div
                style={{
                  padding: "12px 14px",
                  background:
                    Math.abs(userRemainingBalance) < 0.01
                      ? "rgba(67,233,123,0.1)"
                      : userOwes
                        ? "rgba(255,107,107,0.1)"
                        : "rgba(67,233,123,0.1)",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color:
                    Math.abs(userRemainingBalance) < 0.01
                      ? "var(--green)"
                      : userOwes
                        ? "var(--accent1)"
                        : "var(--green)",
                }}
              >
                {Math.abs(userRemainingBalance) < 0.01
                  ? "\u2714 All settled!"
                  : userOwes
                    ? `You still owe \u20B1${formatNum(Math.abs(userRemainingBalance))}`
                    : `You are owed \u20B1${formatNum(Math.abs(userRemainingBalance))}`}
              </div>

              {/* Breakdown rows */}
              <div style={{ padding: "8px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
                {/* Spending summary */}
                {(() => {
                  const userBalance = balances.find(b => b.name === currentUser);
                  if (!userBalance) return null;
                  const paidShare = totalPaidExpensesShare;
                  const totalPaid = userBalance.paid + (userPaidExpenses.filter(e => e.paidBy === currentUser).reduce((s, e) => s + e.amount, 0));
                  const totalShare = userBalance.share + paidShare;
                  const totalBalance = totalPaid - totalShare;
                  return (
                    <>
                      <div style={{ fontSize: "0.75rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "2px 12px" }}>
                          <span style={{ color: "var(--text2)" }}>
                            Spent {"\u20B1"}{formatNum(totalPaid)} {"\u00B7"} Share {"\u20B1"}{formatNum(totalShare)}
                          </span>
                          {Math.abs(totalBalance) > 0.01 && (
                            <span style={{ fontWeight: 700, color: totalBalance > 0 ? "var(--green)" : "var(--accent1)", whiteSpace: "nowrap" }}>
                              {totalBalance > 0 ? "+" : "-"}{"\u20B1"}{formatNum(Math.abs(totalBalance))}
                            </span>
                          )}
                        </div>
                        {paidShare > 0.01 && (
                          <div style={{ fontSize: "0.68rem", color: "var(--text2)", fontStyle: "italic", marginTop: 2 }}>
                            Incl. {"\u20B1"}{formatNum(paidShare)} from settled expenses
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}

                {totalDiffers && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "2px 12px", fontSize: "0.75rem" }}>
                    <span style={{ color: "var(--text2)" }}>Before settlements</span>
                    <span style={{ fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" }}>{"\u20B1"}{formatNum(Math.abs(userCombinedBalance))}</span>
                  </div>
                )}

                {settledToYou > 0.01 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "2px 12px", fontSize: "0.75rem" }}>
                    <span style={{ color: "var(--text2)" }}>Received</span>
                    <span style={{ fontWeight: 600, color: "var(--green)", whiteSpace: "nowrap" }}>+{"\u20B1"}{formatNum(settledToYou)}</span>
                  </div>
                )}

                {settledByYou > 0.01 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "2px 12px", fontSize: "0.75rem" }}>
                    <span style={{ color: "var(--text2)" }}>Paid out</span>
                    <span style={{ fontWeight: 600, color: "var(--accent5)", whiteSpace: "nowrap" }}>-{"\u20B1"}{formatNum(settledByYou)}</span>
                  </div>
                )}

                {Math.abs(userDpExcess) > 0.01 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "2px 12px", fontSize: "0.75rem" }}>
                    <span style={{ color: "var(--text2)" }}>
                      Hotel DP excess <span style={{ fontSize: "0.65rem", fontStyle: "italic", opacity: 0.7 }}>({userDpExcess > 0 ? "deducted from settlements" : "added to settlements"})</span>
                    </span>
                    <span style={{ fontWeight: 600, color: userDpExcess > 0 ? "var(--green)" : "var(--accent1)", whiteSpace: "nowrap" }}>
                      {"\u20B1"}{formatNum(Math.abs(userDpExcess))}
                    </span>
                  </div>
                )}

                {userPaidExpenses.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "2px 12px", fontSize: "0.75rem" }}>
                    <span style={{ color: "var(--text2)" }}>
                      Settled individually ({userPaidExpenses.length})
                    </span>
                    <span style={{ fontWeight: 600, color: "var(--green)", whiteSpace: "nowrap" }}>{"\u20B1"}{formatNum(totalPaidExpensesShare)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

        {currentUser && userPaidExpenses.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                borderRadius: 14,
                overflow: "hidden",
                border: "1px solid rgba(67,233,123,0.2)",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "10px 16px",
                  background: "rgba(67,233,123,0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "0.85rem" }}>{"\u2714"}</span>
                  <span
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      color: "var(--green)",
                    }}
                  >
                    Already Settled
                  </span>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      color: "var(--text2)",
                      background: "var(--surface3)",
                      padding: "2px 8px",
                      borderRadius: 10,
                    }}
                  >
                    {userPaidExpenses.length}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--text2)",
                    display: "flex",
                    gap: 12,
                  }}
                >
                  <span>Total: <strong style={{ color: "var(--text)" }}>{"\u20B1"}{formatNum(totalPaidExpensesAmount)}</strong></span>
                  <span>Your share: <strong style={{ color: "var(--green)" }}>{"\u20B1"}{formatNum(totalPaidExpensesShare)}</strong></span>
                </div>
              </div>

              {/* Table */}
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Total</th>
                      <th>Paid By</th>
                      <th>Your Share</th>
                      <th>Confirmed By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userPaidExpenses.map((exp) => (
                      <tr key={exp.id}>
                        <td style={{ fontSize: "0.82rem" }}>{exp.date}</td>
                        <td style={{ fontSize: "0.82rem" }}>
                          {exp.description}
                          {exp.category && (
                            <span
                              style={{
                                marginLeft: 6,
                                fontSize: "0.65rem",
                                color: "var(--text2)",
                              }}
                            >
                              {CAT_ICONS[exp.category]}{" "}
                              {CAT_LABELS[exp.category]}
                            </span>
                          )}
                        </td>
                        <td style={{ fontVariantNumeric: "tabular-nums", color: "var(--text2)" }}>
                          {"\u20B1"}{formatNum(exp.amount)}
                        </td>
                        <td
                          style={{
                            fontWeight: exp.paidBy === currentUser ? 700 : 400,
                            color: exp.paidBy === currentUser ? "var(--accent5)" : undefined,
                          }}
                        >
                          {exp.paidBy === currentUser ? "You" : exp.paidBy}
                        </td>
                        <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                          {"\u20B1"}{formatNum(exp.share)}
                        </td>
                        <td style={{ fontSize: "0.72rem", color: "var(--text2)" }}>
                          {exp.paidInfo.confirmedBy === currentUser ? "You" : (exp.paidInfo.confirmedBy || "\u2014")}
                          {exp.paidInfo.date ? ` \u00B7 ${exp.paidInfo.date}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer note */}
              <div
                style={{
                  padding: "8px 16px",
                  fontSize: "0.68rem",
                  color: "var(--text2)",
                  background: "rgba(67,233,123,0.03)",
                  borderTop: "1px solid rgba(67,233,123,0.1)",
                }}
              >
                These expenses were settled directly between travelers and are not included in the settlement calculations.
              </div>
            </div>
          </div>
        )}

        {currentUser && userSettlements.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1,
                color: "var(--accent5)",
                marginBottom: 8,
                paddingLeft: 2,
              }}
            >
              Your Settlements
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {userSettlements.map((s, i) => {
                const fromIsUser = s.from === currentUser;
                const toIsUser = s.to === currentUser;
                const key = sKey(s);
                const paid = paidSettlements[key];
                const proof = proofOfPayment[key];
                const proofUrl = proof?.path ? getProofUrl(syncConfig, proof.path) : null;
                return (
                  <div
                    key={`u-${i}`}
                    style={{
                      borderRadius: 12,
                      border: `1px solid ${paid ? "rgba(67,233,123,0.25)" : "rgba(84,160,255,0.3)"}`,
                      background: paid ? "rgba(67,233,123,0.04)" : "rgba(84,160,255,0.04)",
                      padding: "12px 14px",
                      ...(paid ? { opacity: 0.65 } : {}),
                    }}
                  >
                    {/* Flow: From → To + Amount */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "4px 8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: fromIsUser ? 800 : 600, color: fromIsUser ? "var(--accent5)" : "var(--text)" }}>
                          {fromIsUser ? "You" : s.from}
                        </span>
                        <span style={{ color: "var(--accent3)", fontSize: "0.75rem" }}>{"\u2192"}</span>
                        <span style={{ fontWeight: toIsUser ? 800 : 600, color: toIsUser ? "var(--accent5)" : "var(--text)" }}>
                          {toIsUser ? "You" : s.to}
                        </span>
                        {fromIsUser && !toIsUser && hasPaymentDetails(s.to) && (
                          <motion.button
                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.93 }}
                            onClick={() => nameClick(s.to)}
                            style={{
                              background: "var(--gradient1)", border: "none", borderRadius: 20,
                              padding: "3px 10px", fontSize: "0.62rem", fontWeight: 700,
                              color: "white", cursor: "pointer", fontFamily: "Inter, sans-serif",
                              letterSpacing: 0.5, textTransform: "uppercase",
                              boxShadow: "0 2px 6px rgba(102,126,234,0.3)",
                            }}
                          >
                            {"\u{1F4F7}"} QR
                          </motion.button>
                        )}
                      </div>
                      <span style={{ fontSize: "1rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                        {"\u20B1"}{formatNum(s.amount)}
                      </span>
                    </div>

                    {/* Partial payment progress */}
                    {!paid && partialPayments[key] > 0 && (
                      <div style={{
                        marginTop: 8, padding: "8px 12px", borderRadius: 8,
                        background: "rgba(254,202,87,0.08)", border: "1px solid rgba(254,202,87,0.2)",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.72rem", color: "var(--text2)" }}>
                            Received {"\u20B1"}{formatNum(partialPayments[key])} of {"\u20B1"}{formatNum(s.amount)}
                          </span>
                          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--accent1)" }}>
                            Remaining: {"\u20B1"}{formatNum(Math.max(0, s.amount - partialPayments[key]))}
                          </span>
                        </div>
                        <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: "var(--surface3)", overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 2, background: "var(--accent2)", width: `${Math.min(100, (partialPayments[key] / s.amount) * 100)}%`, transition: "width 0.3s" }} />
                        </div>
                      </div>
                    )}

                    {/* Actions row */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                      {/* Proof */}
                      <div>
                        {proofUrl ? (
                          <button
                            onClick={() => setProofModal({ key, url: proofUrl, settlement: s, paid: !!paid })}
                            style={{
                              background: "rgba(84,160,255,0.1)", border: "1px solid rgba(84,160,255,0.25)",
                              borderRadius: 20, padding: "4px 12px", fontSize: "0.68rem", fontWeight: 700,
                              color: "var(--accent5)", cursor: "pointer", fontFamily: "Inter, sans-serif",
                            }}
                          >
                            {"\u{1F4CE}"} View Proof
                          </button>
                        ) : proof?.status === "declined" ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span
                              style={{
                                fontSize: "0.65rem", fontWeight: 700, color: "var(--accent1)",
                                background: "rgba(255,107,107,0.12)", padding: "3px 10px", borderRadius: 12,
                              }}
                            >
                              {"\u2718"} Declined{proof.declineReason ? `: ${proof.declineReason}` : ""}{proof.amountReceived > 0 ? ` (received \u20B1${formatNum(proof.amountReceived)})` : ""}
                            </span>
                            {fromIsUser && (
                              <label
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  background: "var(--surface3)", border: "1px dashed rgba(255,107,107,0.4)",
                                  borderRadius: 20, padding: "3px 10px", fontSize: "0.65rem", fontWeight: 600,
                                  color: "var(--accent1)", cursor: "pointer", fontFamily: "Inter, sans-serif",
                                }}
                              >
                                {proofUploading === key ? (<><Spinner size={10} color="var(--accent1)" /> Uploading...</>) : (<>{"\u{1F4F7}"} Re-upload</>)}
                                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => handleProofUpload(key, e)} style={{ display: "none" }} disabled={!!proofUploading} />
                              </label>
                            )}
                          </div>
                        ) : fromIsUser ? (
                          <label
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              background: "var(--surface3)", border: "1px dashed var(--border)",
                              borderRadius: 20, padding: "4px 12px", fontSize: "0.68rem", fontWeight: 600,
                              color: "var(--text2)", cursor: "pointer", fontFamily: "Inter, sans-serif",
                            }}
                          >
                            {proofUploading === key ? (<><Spinner size={10} color="var(--text2)" /> Uploading...</>) : (<>{"\u{1F4F7}"} Upload Proof</>)}
                            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => handleProofUpload(key, e)} style={{ display: "none" }} disabled={!!proofUploading} />
                          </label>
                        ) : (
                          <span />
                        )}
                      </div>

                      {/* Status */}
                      <div>
                        {paid ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--green)", background: "rgba(67,233,123,0.12)", padding: "4px 12px", borderRadius: 20 }}>
                              {"\u2713"} Paid
                            </span>
                            {toIsUser && (
                              <button onClick={() => handleToggleSettlement(s)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.65rem", color: "var(--text2)", textDecoration: "underline", fontFamily: "Inter, sans-serif", padding: 0 }}>
                                Undo
                              </button>
                            )}
                          </span>
                        ) : toIsUser && !(proof?.status === "declined" && !proof?.path) ? (
                          <motion.button
                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.93 }}
                            onClick={() => handleToggleSettlement(s)}
                            style={{
                              background: "var(--gradient4)", border: "none", borderRadius: 20,
                              padding: "5px 14px", fontSize: "0.68rem", fontWeight: 700,
                              color: "#1a1a2e", cursor: "pointer", fontFamily: "Inter, sans-serif",
                            }}
                          >
                            Confirm Paid
                          </motion.button>
                        ) : (
                          <span style={{ fontSize: "0.68rem", color: "var(--text2)" }}>&mdash;</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {otherSettlements.length > 0 && (
          <div>
            {currentUser && userSettlements.length > 0 && (
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "var(--text2)",
                  marginBottom: 8,
                  paddingLeft: 2,
                }}
              >
                Other Settlements
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {otherSettlements.map((s, i) => {
                const key = sKey(s);
                const paid = paidSettlements[key];
                const proof = proofOfPayment[key];
                const proofUrl = proof?.path ? getProofUrl(syncConfig, proof.path) : null;
                return (
                  <div
                    key={`o-${i}`}
                    style={{
                      borderRadius: 12,
                      border: `1px solid ${paid ? "rgba(67,233,123,0.2)" : "var(--border)"}`,
                      background: paid ? "rgba(67,233,123,0.03)" : "var(--surface2)",
                      padding: "10px 14px",
                      ...(paid ? { opacity: 0.55 } : {}),
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "4px 8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600, color: "var(--text)" }}>{s.from}</span>
                        <span style={{ color: "var(--accent3)", fontSize: "0.72rem" }}>{"\u2192"}</span>
                        <span style={{ fontWeight: 600, color: "var(--text)" }}>{s.to}</span>
                      </div>
                      <span style={{ fontSize: "0.92rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                        {"\u20B1"}{formatNum(s.amount)}
                      </span>
                    </div>

                    {/* Partial payment progress */}
                    {!paid && partialPayments[key] > 0 && (
                      <div style={{
                        marginTop: 6, padding: "6px 10px", borderRadius: 8,
                        background: "rgba(254,202,87,0.08)", border: "1px solid rgba(254,202,87,0.2)",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.68rem", color: "var(--text2)" }}>
                            Received {"\u20B1"}{formatNum(partialPayments[key])} of {"\u20B1"}{formatNum(s.amount)}
                          </span>
                          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--accent1)" }}>
                            Remaining: {"\u20B1"}{formatNum(Math.max(0, s.amount - partialPayments[key]))}
                          </span>
                        </div>
                        <div style={{ marginTop: 4, height: 3, borderRadius: 2, background: "var(--surface3)", overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 2, background: "var(--accent2)", width: `${Math.min(100, (partialPayments[key] / s.amount) * 100)}%`, transition: "width 0.3s" }} />
                        </div>
                      </div>
                    )}

                    {(proofUrl || proof?.status === "declined" || paid) && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                        {proofUrl && (
                          <button
                            onClick={() => setProofModal({ key, url: proofUrl, settlement: s, paid: !!paid })}
                            style={{
                              background: "rgba(84,160,255,0.1)", border: "1px solid rgba(84,160,255,0.25)",
                              borderRadius: 20, padding: "3px 10px", fontSize: "0.65rem", fontWeight: 700,
                              color: "var(--accent5)", cursor: "pointer", fontFamily: "Inter, sans-serif",
                            }}
                          >
                            {"\u{1F4CE}"} View Proof
                          </button>
                        )}
                        {proof?.status === "declined" && (
                          <span
                            style={{
                              fontSize: "0.62rem", fontWeight: 700, color: "var(--accent1)",
                              background: "rgba(255,107,107,0.12)", padding: "3px 10px", borderRadius: 12,
                            }}
                          >
                            {"\u2718"} Declined{proof.declineReason ? `: ${proof.declineReason}` : ""}{proof.amountReceived > 0 ? ` (received \u20B1${formatNum(proof.amountReceived)})` : ""}
                          </span>
                        )}
                        {paid && (
                          <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--green)", background: "rgba(67,233,123,0.12)", padding: "3px 10px", borderRadius: 20 }}>
                            {"\u2713"} Paid
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {combinedSettlements.length === 0 && (
          <div
            style={{ textAlign: "center", padding: 40, color: "var(--text2)" }}
          >
            Add expenses and travelers to see settlements.
          </div>
        )}
      </Card>

      {excessByCollector.length > 0 && totalExcess > 0.01 && (
        <Card>
          <CardTitle icon="&#128176;" gradient="var(--gradient4)">
            DP Excess Returns
          </CardTitle>
          <div
            style={{
              padding: "12px 18px",
              borderRadius: 12,
              marginBottom: 14,
              background: "rgba(67,233,123,0.08)",
              border: "1px solid rgba(67,233,123,0.2)",
              fontSize: "0.82rem",
              color: "var(--text2)",
              lineHeight: 1.7,
            }}
          >
            Total collected: &#8369;{formatNum(totalCollected)} &mdash; Hotel
            cost: &#8369;{formatNum(hotelCost)} &mdash; Excess:{" "}
            <span style={{ fontWeight: 700, color: "var(--green)" }}>
              &#8369;{formatNum(totalExcess)}
            </span>
          </div>
          {excessByCollector.map((e, ci) => (
            <div key={ci} style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  color:
                    currentUser && e.collector === currentUser
                      ? "var(--accent5)"
                      : "var(--text)",
                  marginBottom: 6,
                  paddingLeft: 2,
                }}
              >
                {e.collector}
                {currentUser && e.collector === currentUser ? " (You)" : ""}
                <span
                  style={{
                    fontWeight: 500,
                    color: "var(--text2)",
                    marginLeft: 8,
                  }}
                >
                  &mdash; returns &#8369;{formatNum(e.totalExcess)}
                </span>
              </div>
              <div
                style={{
                  overflowX: "auto",
                  borderRadius: 12,
                  border: "1px solid rgba(67,233,123,0.3)",
                }}
              >
                <table>
                  <thead>
                    <tr>
                      <th>Return To</th>
                      <th>Collected</th>
                      <th>Hotel Share</th>
                      <th>Excess</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.persons.map((p, pi) => (
                      <tr
                        key={pi}
                        style={{
                          background:
                            currentUser && p.person === currentUser
                              ? "rgba(84,160,255,0.08)"
                              : undefined,
                        }}
                      >
                        <td
                          style={{
                            fontWeight: 600,
                            color:
                              currentUser && p.person === currentUser
                                ? "var(--accent5)"
                                : undefined,
                          }}
                        >
                          {p.person}
                          {currentUser && p.person === currentUser
                            ? " (You)"
                            : ""}
                        </td>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>
                          &#8369;{formatNum(p.collected)}
                        </td>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>
                          &#8369;{formatNum(p.hotelShare)}
                        </td>
                        <td
                          style={{
                            fontWeight: 700,
                            fontVariantNumeric: "tabular-nums",
                            color:
                              p.excess > 0
                                ? "var(--green)"
                                : "var(--accent1)",
                          }}
                        >
                          &#8369;{formatNum(p.excess)}
                        </td>
                      </tr>
                    ))}
                    {e.persons.length > 1 && (
                      <tr
                        style={{
                          background: "var(--surface2)",
                          fontWeight: 700,
                        }}
                      >
                        <td>Total</td>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>
                          &#8369;{formatNum(e.totalCollected)}
                        </td>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>
                          &#8369;{formatNum(e.totalHotelShare)}
                        </td>
                        <td
                          style={{
                            fontVariantNumeric: "tabular-nums",
                            color:
                              e.totalExcess > 0
                                ? "var(--green)"
                                : "var(--accent1)",
                          }}
                        >
                          &#8369;{formatNum(e.totalExcess)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </Card>
      )}

      {currentUser && (
        <Card>
          <CardTitle icon="&#128179;" gradient="var(--gradient1)">
            Your Payment Details
          </CardTitle>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 14,
              marginBottom: 14,
            }}
          >
            {WALLET_TYPES.map((f) => {
              const userQr = getUserQr(currentUser);
              const qrPath = userQr[f.key];
              const qrUrl = resolveQrUrl(qrPath);
              return (
                <div
                  key={f.key}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    background: "var(--surface2)",
                    border: "1px solid var(--border)",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent5)";
                    e.currentTarget.style.background = "rgba(84,160,255,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.background = "var(--surface2)";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: "1.1rem" }}>{f.icon}</span>
                    <label style={{ fontSize: "0.75rem", color: "var(--text2)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, margin: 0 }}>
                      {f.label}
                    </label>
                    {savedInfo[f.key] && infoForm[f.key] === savedInfo[f.key] && (
                      <span style={{ marginLeft: "auto", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--green)", background: "rgba(0,210,211,0.15)", padding: "2px 8px", borderRadius: 20 }}>
                        {"\u2713"} Added
                      </span>
                    )}
                  </div>
                  <input
                    value={infoForm[f.key] || ""}
                    onChange={(e) => handleInfoChange(f.key, e.target.value)}
                    placeholder={f.key === "maribank" ? "Account number" : "09XXXXXXXXX"}
                    inputMode="numeric"
                    maxLength={f.key === "maribank" ? 13 : 11}
                    style={{ width: "100%", boxSizing: "border-box", background: "var(--surface3)", borderColor: infoErrors[f.key] ? "var(--accent1)" : "var(--border)", fontSize: "0.88rem", letterSpacing: "1px" }}
                  />
                  {infoErrors[f.key] && (
                    <div style={{ fontSize: "0.68rem", color: "var(--accent1)", marginTop: 6, fontWeight: 500 }}>
                      {"\u26A0"} {infoErrors[f.key]}
                    </div>
                  )}
                  <div style={{ marginTop: 10 }}>
                    {qrUrl ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div
                          style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1.5px solid var(--accent5)", cursor: "pointer", background: "var(--surface3)" }}
                          onClick={() => { setQrWallet(f.key); setQrModal(currentUser); }}
                        >
                          <img src={qrUrl} alt={`${f.label} QR`} style={{ width: "100%", maxHeight: 140, objectFit: "cover", display: "block" }} />
                          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.5))", padding: "12px 8px 6px", textAlign: "center", fontSize: "0.65rem", fontWeight: 600, color: "white", letterSpacing: 0.5, textTransform: "uppercase" }}>
                            Tap to view
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <label style={{ flex: 1, background: "var(--surface3)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 0", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, color: "var(--accent5)", transition: "all 0.2s" }}>
                            {uploading === f.key ? (<><Spinner size={12} color="var(--accent5)" /> Replacing...</>) : (<>{"\u{1F504}"} Replace</>)}
                            <input key={`r-${f.key}-${uploadKey}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleQrUpload(f.key, e)} style={{ display: "none" }} disabled={!!uploading} />
                          </label>
                          <button onClick={() => handleRemoveQr(f.key)} style={{ flex: 1, background: "none", border: "1px solid rgba(255,107,107,0.3)", borderRadius: 8, padding: "6px 0", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer", color: "var(--accent1)", transition: "all 0.2s" }}>
                            {"\u{1F5D1}"} Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label style={{ background: "var(--surface3)", border: "1.5px dashed var(--border)", borderRadius: 10, padding: "14px 12px", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "var(--text2)", transition: "all 0.2s" }}>
                        {uploading === f.key ? (<><Spinner size={12} color="var(--text2)" /> Uploading...</>) : (<>{"\u{1F4F7}"} Upload QR</>)}
                        <input key={`u-${f.key}-${uploadKey}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleQrUpload(f.key, e)} style={{ display: "none" }} disabled={!!uploading} />
                      </label>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Custom payment method — 4th grid item */}
            {customForm ? (
              <div style={{
                padding: 14, borderRadius: 12,
                background: "var(--surface2)", border: "1px solid var(--border)",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "1.1rem" }}>{"\u{1F3E6}"}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text2)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
                      Custom
                    </span>
                  </div>
                  <button
                    onClick={() => { setCustomForm(null); setInfoErrors(prev => ({ ...prev, customLabel: undefined, customNumber: undefined })); }}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: "0.65rem", fontWeight: 600, color: "var(--accent1)",
                      fontFamily: "Inter, sans-serif", textDecoration: "underline",
                    }}
                  >
                    Remove
                  </button>
                </div>
                <input
                  value={customForm.label}
                  onChange={(e) => {
                    setCustomForm(prev => ({ ...prev, label: e.target.value }));
                    setInfoErrors(prev => ({ ...prev, customLabel: undefined }));
                  }}
                  placeholder="Bank / wallet name"
                  maxLength={30}
                  style={{
                    width: "100%", boxSizing: "border-box", marginBottom: 6,
                    background: "var(--surface3)",
                    borderColor: infoErrors.customLabel ? "var(--accent1)" : "var(--border)",
                    fontSize: "0.85rem",
                  }}
                />
                {infoErrors.customLabel && (
                  <div style={{ fontSize: "0.68rem", color: "var(--accent1)", marginBottom: 6, fontWeight: 500 }}>
                    {"\u26A0"} {infoErrors.customLabel}
                  </div>
                )}
                <input
                  value={customForm.number}
                  onChange={(e) => {
                    setCustomForm(prev => ({ ...prev, number: e.target.value }));
                    setInfoErrors(prev => ({ ...prev, customNumber: undefined }));
                  }}
                  placeholder="Account number"
                  maxLength={30}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "var(--surface3)",
                    borderColor: infoErrors.customNumber ? "var(--accent1)" : "var(--border)",
                    fontSize: "0.85rem",
                  }}
                />
                {infoErrors.customNumber && (
                  <div style={{ fontSize: "0.68rem", color: "var(--accent1)", marginTop: 4, fontWeight: 500 }}>
                    {"\u26A0"} {infoErrors.customNumber}
                  </div>
                )}
                {(() => {
                  const userQr = getUserQr(currentUser);
                  const qrUrl = userQr.custom ? resolveQrUrl(userQr.custom) : null;
                  return (
                    <div style={{ marginTop: 10 }}>
                      {qrUrl ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div
                            style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1.5px solid var(--accent5)", cursor: "pointer", background: "var(--surface3)" }}
                            onClick={() => { setQrWallet("custom"); setQrModal(currentUser); }}
                          >
                            <img src={qrUrl} alt="Custom QR" style={{ width: "100%", maxHeight: 140, objectFit: "cover", display: "block" }} />
                            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.5))", padding: "12px 8px 6px", textAlign: "center", fontSize: "0.65rem", fontWeight: 600, color: "white", letterSpacing: 0.5, textTransform: "uppercase" }}>
                              Tap to view
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <label style={{ flex: 1, background: "var(--surface3)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 0", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, color: "var(--accent5)", transition: "all 0.2s" }}>
                              {uploading === "custom" ? (<><Spinner size={12} color="var(--accent5)" /> Replacing...</>) : (<>{"\u{1F504}"} Replace</>)}
                              <input key={`r-custom-${uploadKey}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleQrUpload("custom", e)} style={{ display: "none" }} disabled={!!uploading} />
                            </label>
                            <button onClick={() => handleRemoveQr("custom")} style={{ flex: 1, background: "none", border: "1px solid rgba(255,107,107,0.3)", borderRadius: 8, padding: "6px 0", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer", color: "var(--accent1)", transition: "all 0.2s" }}>
                              {"\u{1F5D1}"} Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label style={{ background: "var(--surface3)", border: "1.5px dashed var(--border)", borderRadius: 10, padding: "14px 12px", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "var(--text2)", transition: "all 0.2s" }}>
                          {uploading === "custom" ? (<><Spinner size={12} color="var(--text2)" /> Uploading...</>) : (<>{"\u{1F4F7}"} Upload QR</>)}
                          <input key={`u-custom-${uploadKey}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleQrUpload("custom", e)} style={{ display: "none" }} disabled={!!uploading} />
                        </label>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div
                onClick={() => setCustomForm({ label: "", number: "" })}
                style={{
                  padding: 14, borderRadius: 12,
                  border: "1.5px dashed var(--border)", background: "var(--surface2)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 8, fontSize: "0.78rem", fontWeight: 600, color: "var(--text2)",
                  fontFamily: "Inter, sans-serif", transition: "all 0.2s",
                  minHeight: 80,
                }}
              >
                {"\u2795"} Add Custom
              </div>
            )}
          </div>

          <motion.button
            whileHover={infoDirty ? { y: -2, boxShadow: "0 6px 20px rgba(67,233,123,0.3)" } : undefined}
            whileTap={infoDirty ? { y: 0 } : undefined}
            onClick={handleInfoSave}
            disabled={!infoDirty}
            style={{
              background: infoDirty ? "var(--gradient4)" : "var(--surface3)",
              color: infoDirty ? "#1a1a2e" : "var(--text2)",
              border: "none", borderRadius: 10, padding: "10px 20px",
              fontFamily: "Inter, sans-serif", fontSize: "0.88rem", fontWeight: 600,
              cursor: infoDirty ? "pointer" : "not-allowed",
              display: "inline-flex", alignItems: "center", gap: 8,
              transition: "all 0.2s", width: "100%",
            }}
          >
            {"\u2713"} Save Payment Details
          </motion.button>
        </Card>
      )}
      </div>

      <div className="settlement-col">
        {expensesByPair.length > 0 && (
          <Card>
            <div
              onClick={() => setBreakdownOpen(v => !v)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: "pointer", userSelect: "none", marginBottom: breakdownOpen ? 0 : -8,
              }}
            >
              <CardTitle icon="&#128203;" gradient="var(--gradient3)">
                Expense Breakdown
              </CardTitle>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {!breakdownOpen && (
                  <span style={{ fontSize: "0.7rem", color: "var(--text2)", fontWeight: 600 }}>
                    {expensesByPair.length} {expensesByPair.length === 1 ? "pair" : "pairs"}
                  </span>
                )}
                <motion.span
                  animate={{ rotate: breakdownOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ fontSize: "0.85rem", color: "var(--text2)", display: "inline-flex" }}
                >
                  &#9660;
                </motion.span>
              </div>
            </div>
            <AnimatePresence initial={false}>
              {breakdownOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ overflow: "hidden" }}
                >
            {currentUser && (() => {
              let toMe = 0;
              let fromMe = 0;
              expensesByPair.forEach((pair) => {
                const total = pair.expenses.filter(e => !e.isPaid).reduce((s, e) => s + e.owedAmount, 0);
                if (pair.to === currentUser) toMe += total;
                if (pair.from === currentUser) fromMe += total;
              });
              return (toMe > 0.01 || fromMe > 0.01) ? (
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    marginBottom: 10,
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    paddingLeft: 2,
                  }}
                >
                  {toMe > 0.01 && (
                    <span style={{ color: "var(--green)" }}>
                      Owed to you: {"\u20B1"}{formatNum(toMe)}
                    </span>
                  )}
                  {fromMe > 0.01 && (
                    <span style={{ color: "var(--accent1)" }}>
                      You owe: {"\u20B1"}{formatNum(fromMe)}
                    </span>
                  )}
                </div>
              ) : null;
            })()}
            {currentUser && (
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                {[{ key: "mine", label: "All Mine" }, { key: "to_me", label: "To Me" }, { key: "from_me", label: "From Me" }, { key: "all", label: "All" }].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setBreakdownFilter(f.key)}
                    style={{
                      padding: "5px 14px",
                      borderRadius: 20,
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "none",
                      background:
                        breakdownFilter === f.key
                          ? "var(--gradient1)"
                          : "var(--surface3)",
                      color:
                        breakdownFilter === f.key ? "white" : "var(--text2)",
                      boxShadow:
                        breakdownFilter === f.key
                          ? "0 2px 8px rgba(102,126,234,0.3)"
                          : "none",
                      fontFamily: "Inter, sans-serif",
                      transition: "all 0.2s",
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            {expensesByPair
              .filter(
                (pair) =>
                  breakdownFilter === "all" ||
                  !currentUser ||
                  (breakdownFilter === "mine" && (pair.to === currentUser || pair.from === currentUser)) ||
                  (breakdownFilter === "to_me" && pair.to === currentUser) ||
                  (breakdownFilter === "from_me" && pair.from === currentUser),
              )
              .map((pair, pi) => {
              const fromIsUser = currentUser && pair.from === currentUser;
              const toIsUser = currentUser && pair.to === currentUser;
              const pairTotal = pair.expenses.filter(e => !e.isPaid).reduce(
                (s, e) => s + e.owedAmount,
                0,
              );
              const paidTotal = pair.expenses.filter(e => e.isPaid).reduce(
                (s, e) => s + e.owedAmount,
                0,
              );
              return (
                <div key={pi} style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      letterSpacing: 0.5,
                      marginBottom: 6,
                      paddingLeft: 2,
                      color:
                        fromIsUser || toIsUser
                          ? "var(--accent5)"
                          : "var(--text)",
                    }}
                  >
                    {pair.from}
                    {fromIsUser ? " (You)" : ""} &rarr; {pair.to}
                    {toIsUser ? " (You)" : ""}
                    <span
                      style={{
                        fontWeight: 500,
                        color: "var(--text2)",
                        marginLeft: 8,
                      }}
                    >
                      &mdash; &#8369;{formatNum(pairTotal)}
                    </span>
                    {paidTotal > 0.01 && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: "0.65rem",
                          fontWeight: 600,
                          color: "var(--green)",
                          background: "rgba(67,233,123,0.1)",
                          padding: "1px 8px",
                          borderRadius: 10,
                        }}
                      >
                        &#10003; &#8369;{formatNum(paidTotal)} paid
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      overflowX: "auto",
                      borderRadius: 10,
                      border: `1px solid ${fromIsUser || toIsUser ? "rgba(84,160,255,0.3)" : "var(--border)"}`,
                    }}
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Description</th>
                          <th>Owed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pair.expenses.map((exp) => (
                          <tr
                            key={exp.id}
                            style={{
                              ...(fromIsUser || toIsUser
                                ? { background: "rgba(84,160,255,0.05)" }
                                : {}),
                              ...(exp.isPaid ? { opacity: 0.45 } : {}),
                            }}
                          >
                            <td style={{ fontSize: "0.82rem" }}>{exp.date}</td>
                            <td style={{ fontSize: "0.82rem" }}>
                              <span style={exp.isPaid ? { textDecoration: "line-through" } : undefined}>{exp.description}</span>
                              {exp.isPaid && <span style={{ marginLeft: 6, fontSize: "0.6rem", fontWeight: 700, color: "var(--green)", background: "rgba(67,233,123,0.12)", padding: "1px 6px", borderRadius: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Paid</span>}
                            </td>
                            <td
                              style={{
                                fontWeight: 700,
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              &#8369;{formatNum(exp.owedAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            {breakdownFilter !== "all" &&
              expensesByPair.filter(
                (pair) =>
                  (breakdownFilter === "mine" && (pair.to === currentUser || pair.from === currentUser)) ||
                  (breakdownFilter === "to_me" && pair.to === currentUser) ||
                  (breakdownFilter === "from_me" && pair.from === currentUser),
              ).length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: 20,
                    color: "var(--text2)",
                    fontSize: "0.82rem",
                  }}
                >
                  {breakdownFilter === "to_me"
                    ? "No expenses owed to you."
                    : breakdownFilter === "from_me"
                      ? "No expenses you owe."
                      : "No expenses involving you."}
                </div>
              )}
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        )}
      </div>
      </div>

      <Modal open={!!qrModal} onClose={() => setQrModal(null)}>
        {qrModal &&
          (() => {
            const isOwnModal = qrModal === currentUser;
            const rawInfo = isOwnModal
              ? {
                  gcash: infoForm.gcash || "",
                  maya: infoForm.maya || "",
                  maribank: infoForm.maribank || "",
                  custom: customForm && customForm.label ? customForm : (savedCustom || null),
                }
              : paymentInfo[qrModal] || {};
            const info = rawInfo;
            const qr = getUserQr(qrModal);
            const availableWallets = [
              ...WALLET_TYPES.filter((w) => qr[w.key] || info[w.key]),
              ...(info.custom?.label && (qr.custom || info.custom?.number)
                ? [{ key: "custom", label: info.custom.label, icon: "\u{1F3E6}" }]
                : []),
            ];
            const activeKey =
              qrWallet && (qr[qrWallet] || info[qrWallet] || (qrWallet === "custom" && info.custom?.number))
                ? qrWallet
                : availableWallets[0]?.key || null;
            const activeUrl =
              activeKey && qr[activeKey] ? resolveQrUrl(qr[activeKey]) : null;
            const activeLabel =
              activeKey === "custom"
                ? info.custom?.label || "Custom"
                : WALLET_TYPES.find((w) => w.key === activeKey)?.label || "";
            const activeNumber =
              activeKey === "custom"
                ? info.custom?.number || null
                : activeKey ? info[activeKey] : null;
            return (
              <>
                <h3 style={{ color: "var(--accent5)", marginBottom: 16 }}>
                  &#128178; {qrModal}'s Payment Details
                </h3>
                {availableWallets.length > 0 ? (
                  <>
                    {availableWallets.length > 1 && (
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          marginBottom: 14,
                          justifyContent: "center",
                        }}
                      >
                        {availableWallets.map((w) => (
                          <button
                            key={w.key}
                            onClick={() => setQrWallet(w.key)}
                            style={{
                              padding: "6px 16px",
                              borderRadius: 20,
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              cursor: "pointer",
                              transition: "all 0.2s",
                              border: "none",
                              background:
                                activeKey === w.key
                                  ? "var(--gradient1)"
                                  : "var(--surface3)",
                              color:
                                activeKey === w.key ? "white" : "var(--text2)",
                              boxShadow:
                                activeKey === w.key
                                  ? "0 2px 8px rgba(102,126,234,0.3)"
                                  : "none",
                            }}
                          >
                            {w.icon} {w.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {availableWallets.length === 1 && (
                      <div
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: "var(--text2)",
                          textTransform: "uppercase",
                          marginBottom: 8,
                          textAlign: "center",
                        }}
                      >
                        {availableWallets[0].icon} {availableWallets[0].label}
                      </div>
                    )}
                    {activeNumber && (
                      <div
                        onClick={() => {
                          navigator.clipboard
                            .writeText(activeNumber)
                            .then(() =>
                              dispatch(toast(`${activeLabel} number copied!`)),
                            )
                            .catch(() => {});
                        }}
                        style={{
                          marginBottom: 10,
                          padding: "8px 12px",
                          borderRadius: 10,
                          background: "var(--surface2)",
                          border: "1px solid var(--border)",
                          fontSize: "0.84rem",
                          textAlign: "center",
                          cursor: "pointer",
                          transition: "all 0.15s",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        <span>
                          <span
                            style={{ color: "var(--text2)", fontWeight: 600 }}
                          >
                            {activeLabel}:
                          </span>{" "}
                          {activeNumber}
                        </span>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            color: "var(--accent5)",
                            fontWeight: 600,
                          }}
                        >
                          {"\u{1F4CB}"} Copy
                        </span>
                      </div>
                    )}
                    {activeUrl && (
                      <div style={{ textAlign: "center" }}>
                        <img
                          src={activeUrl}
                          alt={`${qrModal}'s ${activeLabel} QR`}
                          style={{
                            maxWidth: "100%",
                            maxHeight: "60vh",
                            borderRadius: 10,
                            border: "1px solid var(--border)",
                          }}
                        />
                      </div>
                    )}
                    {!activeUrl && !activeNumber && (
                      <div
                        style={{
                          textAlign: "center",
                          padding: 30,
                          color: "var(--text2)",
                        }}
                      >
                        No details for {activeLabel}.
                      </div>
                    )}
                  </>
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 30,
                      color: "var(--text2)",
                    }}
                  >
                    No payment details available.
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 10,
                    marginTop: 14,
                  }}
                >
                  {activeUrl && (
                    <Btn
                      small
                      variant="primary"
                      onClick={async () => {
                        try {
                          const res = await fetch(activeUrl);
                          const blob = await res.blob();
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = `${qrModal}_${activeLabel}_QR.${blob.type.split("/")[1] || "jpg"}`;
                          a.click();
                          URL.revokeObjectURL(a.href);
                        } catch {
                          dispatch(toast("Download failed.", "error"));
                        }
                      }}
                    >
                      {`\u{2B07}`} Download {activeLabel} QR
                    </Btn>
                  )}
                  <Btn small variant="ghost" onClick={() => setQrModal(null)}>
                    Close
                  </Btn>
                </div>
              </>
            );
          })()}
      </Modal>

      <Modal open={!!proofModal} onClose={() => setProofModal(null)}>
        {proofModal &&
          (() => {
            const { key, url, settlement } = proofModal;
            const fromIsUser = currentUser && settlement.from === currentUser;
            const toIsUser = currentUser && settlement.to === currentUser;
            const proof = proofOfPayment[key];
            const isPdf = url && /\.pdf/i.test(url);
            return (
              <>
                <h3 style={{ color: "var(--accent5)", marginBottom: 12 }}>
                  &#128206; Proof of Payment
                </h3>
                <div
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--text2)",
                    marginBottom: 14,
                    padding: "8px 12px",
                    borderRadius: 10,
                    background: "var(--surface2)",
                    border: "1px solid var(--border)",
                    textAlign: "center",
                  }}
                >
                  <span style={{ fontWeight: 600, color: "var(--text)" }}>
                    {settlement.from}
                  </span>{" "}
                  &rarr;{" "}
                  <span style={{ fontWeight: 600, color: "var(--text)" }}>
                    {settlement.to}
                  </span>{" "}
                  &mdash;{" "}
                  <span style={{ fontWeight: 700 }}>
                    &#8369;{formatNum(settlement.amount)}
                  </span>
                </div>
                <div style={{ textAlign: "center" }}>
                  {isPdf ? (
                    <iframe
                      src={url}
                      style={{
                        width: "80vw",
                        maxWidth: 600,
                        height: "60vh",
                        border: "none",
                        borderRadius: 10,
                      }}
                    />
                  ) : (
                    <img
                      src={url}
                      alt="Proof of payment"
                      style={{
                        maxWidth: "100%",
                        maxHeight: "60vh",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                      }}
                    />
                  )}
                </div>
                {proof?.uploadedBy && (
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--text2)",
                      textAlign: "center",
                      marginTop: 8,
                    }}
                  >
                    Uploaded by {proof.uploadedBy}
                    {proof.at ? ` on ${proof.at.slice(0, 10)}` : ""}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 10,
                    marginTop: 14,
                    flexWrap: "wrap",
                  }}
                >
                  <Btn
                    small
                    variant="primary"
                    onClick={async () => {
                      try {
                        const res = await fetch(url);
                        const blob = await res.blob();
                        const a = document.createElement("a");
                        a.href = URL.createObjectURL(blob);
                        a.download = `proof_${key}.${blob.type.split("/")[1] || "jpg"}`;
                        a.click();
                        URL.revokeObjectURL(a.href);
                      } catch {
                        dispatch(toast("Download failed.", "error"));
                      }
                    }}
                  >
                    {"\u{2B07}"} Download
                  </Btn>
                  {fromIsUser && !proofModal.paid && (
                    <>
                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: "var(--surface3)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          padding: "6px 14px",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          color: "var(--accent5)",
                          cursor: "pointer",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        {proofUploading === key ? (
                          <>
                            <Spinner size={12} color="var(--accent5)" />{" "}
                            Replacing...
                          </>
                        ) : (
                          <>{"\u{1F504}"} Replace</>
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={(e) => {
                            handleProofUpload(key, e);
                            setProofModal(null);
                          }}
                          style={{ display: "none" }}
                          disabled={!!proofUploading}
                        />
                      </label>
                      <Btn
                        small
                        variant="danger"
                        onClick={() => {
                          handleProofRemove(key);
                          setProofModal(null);
                        }}
                      >
                        {"\u{1F5D1}"} Remove
                      </Btn>
                    </>
                  )}
                  {toIsUser && !proofModal.paid && (
                    <>
                      <Btn
                        small
                        variant="success"
                        onClick={() => {
                          handleToggleSettlement(settlement);
                          setProofModal(null);
                        }}
                      >
                        {"\u2713"} Confirm Paid
                      </Btn>
                      <Btn
                        small
                        variant="danger"
                        onClick={() => {
                          setProofModal(null);
                          setDeclineModal({ key, settlement });
                          setDeclineReason("");
                          setDeclineAmount("");
                        }}
                      >
                        {"\u2718"} Decline
                      </Btn>
                    </>
                  )}
                  <Btn
                    small
                    variant="ghost"
                    onClick={() => setProofModal(null)}
                  >
                    Close
                  </Btn>
                </div>
              </>
            );
          })()}
      </Modal>

      {declineModal && (
        <div
          onClick={() => setDeclineModal(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)",
              borderRadius: 14,
              padding: 24,
              maxWidth: 400,
              width: "100%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                fontSize: "0.95rem",
                fontWeight: 700,
                marginBottom: 12,
                color: "var(--accent1)",
              }}
            >
              {"\u2718"} Decline Proof of Payment
            </div>
            <div
              style={{
                fontSize: "0.78rem",
                color: "var(--text2)",
                marginBottom: 12,
                padding: "8px 12px",
                borderRadius: 10,
                background: "var(--surface2)",
                border: "1px solid var(--border)",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--text)" }}>
                {declineModal.settlement.from}
              </span>{" "}
              &rarr;{" "}
              <span style={{ fontWeight: 600, color: "var(--text)" }}>
                {declineModal.settlement.to}
              </span>{" "}
              &mdash;{" "}
              <span style={{ fontWeight: 700 }}>
                &#8369;{formatNum(declineModal.settlement.amount)}
              </span>
            </div>
            {(() => {
              const prevPaid = partialPayments[declineModal.key] || 0;
              const remaining = Math.max(0, declineModal.settlement.amount - prevPaid);
              return (
                <>
                  {prevPaid > 0 && (
                    <div style={{
                      fontSize: "0.75rem", color: "var(--text2)", marginBottom: 10,
                      padding: "6px 10px", borderRadius: 8,
                      background: "rgba(254,202,87,0.08)", border: "1px solid rgba(254,202,87,0.2)",
                    }}>
                      Previously received: <span style={{ fontWeight: 700, color: "var(--accent2)" }}>{"\u20B1"}{formatNum(prevPaid)}</span>
                      {" "}&middot;{" "}
                      Remaining: <span style={{ fontWeight: 700, color: "var(--accent1)" }}>{"\u20B1"}{formatNum(remaining)}</span>
                    </div>
                  )}
                  <div style={{ fontSize: "0.78rem", color: "var(--text2)", marginBottom: 8 }}>
                    Amount received {prevPaid > 0 ? "this time" : ""} (optional):
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text2)", fontSize: "0.85rem", fontWeight: 600, pointerEvents: "none" }}>{"\u20B1"}</span>
                      <input
                        type="number"
                        value={declineAmount}
                        onChange={(e) => setDeclineAmount(e.target.value)}
                        placeholder={`of ${formatNum(remaining)}`}
                        min="0"
                        max={remaining}
                        step="0.01"
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          background: "var(--surface3)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          padding: "10px 10px 10px 28px",
                          fontSize: "0.85rem",
                          fontFamily: "Inter, sans-serif",
                          color: "var(--text)",
                        }}
                      />
                    </div>
                    {declineAmount && Number(declineAmount) > 0 && (
                      Number(declineAmount) >= remaining ? (
                        <div style={{
                          fontSize: "0.78rem", fontWeight: 700, color: "var(--green)",
                          background: "rgba(67,233,123,0.1)", padding: "6px 12px", borderRadius: 8,
                          whiteSpace: "nowrap",
                        }}>
                          {"\u2713"} Fully covered — will mark as paid
                        </div>
                      ) : (
                        <div style={{
                          fontSize: "0.78rem", fontWeight: 700, color: "var(--accent1)",
                          background: "rgba(255,107,107,0.1)", padding: "6px 12px", borderRadius: 8,
                          whiteSpace: "nowrap",
                        }}>
                          Short {"\u20B1"}{formatNum(remaining - Number(declineAmount))}
                        </div>
                      )
                    )}
                  </div>
                </>
              );
            })()}
            <div style={{ fontSize: "0.78rem", color: "var(--text2)", marginBottom: 8 }}>
              Reason (optional):
            </div>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g. Short amount, blurry screenshot, wrong recipient..."
              rows={2}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "var(--surface3)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 10,
                fontSize: "0.85rem",
                resize: "vertical",
                fontFamily: "Inter, sans-serif",
                color: "var(--text)",
              }}
            />
            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 14,
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setDeclineModal(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--surface2)",
                  color: "var(--text2)",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const amt = Number(declineAmount) || 0;
                  if (!declineReason.trim() && amt <= 0) {
                    dispatch(toast("Please add a reason or the amount received.", "error"));
                    return;
                  }
                  const prevPaid = partialPayments[declineModal.key] || 0;
                  const remaining = Math.max(0, declineModal.settlement.amount - prevPaid);
                  if (amt > 0 && amt >= remaining) {
                    handleProofDecline(declineModal.key, declineReason.trim(), remaining);
                    const date = new Date().toISOString().slice(0, 10);
                    dispatch(markSettlementPaid({ key: declineModal.key, confirmedBy: currentUser, date }));
                    dispatch(toast("Full amount received — settlement marked as paid!"));
                    setDeclineModal(null);
                    return;
                  }
                  handleProofDecline(declineModal.key, declineReason.trim(), amt);
                  setDeclineModal(null);
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--accent1)",
                  color: "white",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Decline Proof
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
