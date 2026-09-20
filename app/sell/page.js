
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

// เกณฑ์แจ้งเตือนสต๊อกเหลือน้อย
const LOW_STOCK_THRESHOLD = 5;

export default function SellPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState("");

  const [cart, setCart] = useState([]);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      setErrorMsg(error.message);
    } else {
      setProducts(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const selectedProduct = products.find((p) => p.id === selectedId);
  const qtyNumber = parseInt(quantity, 10) || 0;

  const grandTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const qtyInCart = (productId) =>
    cart.find((item) => item.productId === productId)?.quantity || 0;

  const handleAddToCart = () => {
    setErrorMsg("");
    if (!selectedProduct) {
      setErrorMsg("กรุณาเลือกสินค้า");
      return;
    }
    if (qtyNumber <= 0) {
      setErrorMsg("กรุณากรอกจำนวนให้ถูกต้อง");
      return;
    }

    const alreadyInCart = qtyInCart(selectedProduct.id);
    if (alreadyInCart + qtyNumber > selectedProduct.stock) {
      setErrorMsg(
        `สินค้าคงเหลือไม่พอ (คงเหลือ ${selectedProduct.stock} ${selectedProduct.unit}, ในตะกร้ามีแล้ว ${alreadyInCart})`
      );
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === selectedProduct.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === selectedProduct.id
            ? { ...item, quantity: item.quantity + qtyNumber }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: selectedProduct.id,
          sku: selectedProduct.sku,
          name: selectedProduct.name,
          price: selectedProduct.price,
          unit: selectedProduct.unit,
          stock: selectedProduct.stock,
          quantity: qtyNumber,
        },
      ];
    });

    setSelectedId("");
    setQuantity("");
  };

  const handleChangeCartQty = (productId, newQty) => {
    const qty = parseInt(newQty, 10) || 0;
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, quantity: qty } : item
      )
    );
  };

  const handleRemoveFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const resetAll = () => {
    setCart([]);
    setSelectedId("");
    setQuantity("");
  };

  // ==== เพิ่มใหม่: ฟังก์ชันยิงข้อความแจ้งเตือนเข้า Telegram ผ่าน API Route ====
  // ทำงานแบบ try/catch เดี่ยวๆ ถ้าพลาดจะไม่กระทบระบบขายหลัก
  const sendTelegramNotification = async (text) => {
    try {
      await fetch("/api/telegram-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
    } catch (err) {
      // แจ้งเตือนไม่สำเร็จ แต่ไม่ทำให้ระบบขายพัง แค่ log ไว้เฉยๆ
      console.error("ส่ง Telegram แจ้งเตือนไม่สำเร็จ:", err);
    }
  };

  // ==== เพิ่มใหม่: สร้างข้อความแจ้งเตือน Order เข้า ====
  const buildOrderMessage = (item, newStock) => {
    const time = new Date().toLocaleString("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return (
      `🛍️ <b>มีรายการขายใหม่!</b>\n` +
      `- สินค้า: ${item.name}\n` +
      `- จำนวน: ${item.quantity} ชิ้น\n` +
      `- ราคารวม: ${(item.price * item.quantity).toFixed(2)} บาท\n` +
      `- สต๊อกคงเหลือปัจจุบัน: ${newStock} ชิ้น\n` +
      `- เวลา: ${time}`
    );
  };

  // ==== เพิ่มใหม่: สร้างข้อความแจ้งเตือนสต๊อกใกล้หมด ====
  const buildLowStockMessage = (item, newStock) => {
    return (
      `🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>\n` +
      `- สินค้า: ${item.name}\n` +
      `- คงเหลือเพียง: ${newStock} ชิ้น\n` +
      `⚠️ กรุณาเติมสต๊อกสินค้าด่วน!`
    );
  };

  const handleConfirmSale = async () => {
    setErrorMsg("");
    setSuccessMsg("");

    if (cart.length === 0) {
      setErrorMsg("ยังไม่มีสินค้าในตะกร้า");
      return;
    }

    const invalidItem = cart.find((item) => item.quantity <= 0);
    if (invalidItem) {
      setErrorMsg(`กรุณากรอกจำนวนของ "${invalidItem.name}" ให้ถูกต้อง`);
      return;
    }

    for (const item of cart) {
      const current = products.find((p) => p.id === item.productId);
      if (!current || item.quantity > current.stock) {
        setErrorMsg(
          `สินค้า "${item.name}" คงเหลือไม่พอ (คงเหลือ ${current ? current.stock : 0} ${item.unit})`
        );
        return;
      }
    }

    setSubmitting(true);

    const salesRows = cart.map((item) => ({
      product_id: item.productId,
      product_name: item.name,
      quantity: item.quantity,
      total_price: item.price * item.quantity,
      sold_at: new Date().toISOString(),
    }));

    const { error: saleError } = await supabase.from("sales").insert(salesRows);

    if (saleError) {
      setErrorMsg(saleError.message);
      setSubmitting(false);
      return;
    }

    // ==== เพิ่มใหม่: เก็บสต๊อกหลังตัดของแต่ละชิ้น ไว้ใช้ยิง Telegram ====
    const stockUpdates = [];

    for (const item of cart) {
      const current = products.find((p) => p.id === item.productId);
      const newStock = (current ? current.stock : 0) - item.quantity;

      const { error: updateError } = await supabase
        .from("products")
        .update({ stock: newStock })
        .eq("id", item.productId);

      if (updateError) {
        setErrorMsg(
          `บันทึกการขายสำเร็จ แต่อัปเดตสต็อกของ "${item.name}" ไม่สำเร็จ: ${updateError.message}`
        );
        setSubmitting(false);
        fetchProducts();
        return;
      }

      stockUpdates.push({ item, newStock });
    }

    // แสดงผลสำเร็จให้ผู้ใช้ก่อน ไม่รอ Telegram
    setSuccessMsg(
      `ขายสำเร็จ ${cart.length} รายการ รวม ${grandTotal.toFixed(2)} บาท`
    );
    resetAll();
    fetchProducts();
    setSubmitting(false);

    // ==== เพิ่มใหม่: ยิงแจ้งเตือน Telegram หลังตัดสต๊อกสำเร็จ (ไม่ block UI) ====
    for (const { item, newStock } of stockUpdates) {
      sendTelegramNotification(buildOrderMessage(item, newStock));

      if (newStock <= LOW_STOCK_THRESHOLD) {
        sendTelegramNotification(buildLowStockMessage(item, newStock));
      }
    }
  };

  return (
    <div>
      <h1>ขายสินค้า</h1>

      <div className="sale-summary">
        <div className="sale-summary-label">ยอดรวมทั้งหมด</div>
        <div className="sale-summary-total">{grandTotal.toFixed(2)} บาท</div>
        <div className="sale-summary-count">{cart.length} รายการในตะกร้า</div>
      </div>

      {errorMsg && (
        <p style={{ color: "red", fontWeight: "bold" }}>{errorMsg}</p>
      )}
      {successMsg && (
        <p style={{ color: "green", fontWeight: "bold" }}>{successMsg}</p>
      )}

      {loading ? (
        <p>กำลังโหลดข้อมูลสินค้า...</p>
      ) : (
        <>
          <div className="card">
            <h2>เลือกสินค้า</h2>
            <div className="sell-add-row">
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <option value="">-- เลือกสินค้า --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.price} บาท (คงเหลือ {p.stock} {p.unit})
                  </option>
                ))}
              </select>

              <input
                type="number"
                min="1"
                placeholder="จำนวน"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />

              <button type="button" onClick={handleAddToCart}>
                + เพิ่มลงตะกร้า
              </button>
            </div>
          </div>

          <div className="card">
            <h2>รายการที่จะขาย</h2>
            {cart.length === 0 ? (
              <p>ยังไม่มีสินค้าในตะกร้า</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>สินค้า</th>
                    <th>ราคา/หน่วย</th>
                    <th>จำนวน</th>
                    <th>รวม</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.productId}>
                      <td>{item.name}</td>
                      <td>
                        {item.price} บาท / {item.unit}
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleChangeCartQty(item.productId, e.target.value)
                          }
                          style={{ width: "70px" }}
                        />
                      </td>
                      <td>{(item.price * item.quantity).toFixed(2)}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(item.productId)}
                          style={{ backgroundColor: "#e33" }}
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="sell-actions">
              <button
                type="button"
                onClick={handleConfirmSale}
                disabled={submitting || cart.length === 0}
                className="btn-confirm"
              >
                {submitting ? "กำลังบันทึก..." : "ยืนยันการขาย"}
              </button>
              <button
                type="button"
                onClick={resetAll}
                disabled={submitting || cart.length === 0}
                className="btn-secondary"
              >
                ล้างตะกร้า
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
