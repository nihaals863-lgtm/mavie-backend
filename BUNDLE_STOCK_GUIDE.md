# Walkthrough: Fixing Bundle Stock Out & Manual Stock In

This guide explains the technical issue that was affecting Bundle Components during Stock Out and Manual Stock Increases, and details how the logic was resolved.

---

## 🔎 Symptoms of the Issue
1. **Deduction Mismatch (Stock Out):** When a user triggers **Stock Out** on a Bundle tied to a specific warehouse (e.g. *Warehouse 2*), its individual sub-parts would not decrease in that warehouse. Instead, the logic inadvertently decremented inventory quantities scattered across random locations.
2. **Reverse/Undo Error:** Inside the rows list screen, deleting an adjustment row targeting a Bundle was fully skipping reversing adding items back.

---

## ⚖️ The Technical Root Cause
The backend recursive loops inside the controller **lacked strict warehouse isolation filters**. 

**The bug code originally executed lookups like this:**
```javascript
let pStock = await ProductStock.findOne({ where: { productId: pid } });
```
* **Why it was breaking:** `.findOne()` returns the **first record found** in your database rowset. If a component (such as *Cavo Rosa*) sits in both Warehouse 1 and Warehouse 2, it grabbed the first absolute slot ID available and manipulated *that* number directly, even if the primary Bundled order meant executing on Warehouse 2.

---

## 🛠️ Step-by-Step Fix Summary
The updates took place entirely inside: **`backendwms/services/inventoryService.js`**.

### **Step 1: Fixing standard Deductions / Increases**
Locate the component updates loop inside `createAdjustment()`.
* **Original:** 
  `let pStock = await ProductStock.findOne({ where: { productId: pid } });`
* **Resolution:** 
  `let pStock = await ProductStock.findOne({ where: { productId: pid, warehouseId: warehouseId || null } });`

### **Step 2: Fixing History row reversals**
Locate the cancellation loop inside `removeAdjustment()`.
* **Original:**
  `const pStock = await ProductStock.findOne({ where: { productId: pid } });`
* **Resolution:**
  `const pStock = await ProductStock.findOne({ where: { productId: pid, warehouseId: adj.warehouseId || null } });`

---

## 💡 Best Practices Operational Note
Everything is fully operational factoring any manual edits. However, please avoid performing **Hard Deletions on Parent Products** from your catalog if that exact product ID possesses active history adjusters. 
If the parent blueprint is hard wiped away upfront, the system can no longer know that row derived quantities downward to its children. Use "INACTIVE" status flows instead for obsolete stocks to preserve recursive look-backs accurately.
