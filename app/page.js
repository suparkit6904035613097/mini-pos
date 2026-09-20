"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function SellPage() {
  // รายการสินค้าทั้งหมด (สำหรับ dropdown)
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // สินค้าที่กำลังเลือกเพื่อเพิ่มลงตะกร้า
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState("");

  // ตะกร้าสินค้า (รายการที่จะขายในรอบนี้)
  // แต่ละ item: { productId, sku, name, price, unit, stock, quantity }
  const [cart, setCart] = useState([]);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ดึงรายการสินค้าจาก Supabase
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

  // ยอดรวมทั้งหมดในตะกร้า
  const grandTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // จำนวนที่อยู่ในตะกร้าแล้วของสินค้าชิ้นหนึ่ง (กันขายเกิน stock)
  const qtyInCart = (productId) =>
    cart.find((item) => item.productId === productId)?.quantity || 0;

  // เพิ่มสินค้าลงตะกร้า
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
        // ถ้ามีสินค้านี้ในตะกร้าแล้ว ให้รวมจำนวนเข้าด้วยกัน
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

  // ปรับจำนวนสินค้าในตะกร้า
  const handleChangeCartQty = (productId, newQty) => {
    const qty = parseInt(newQty, 10) || 0;
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, quantity: qty } : item
      )
    );
  };

  // ลบสินค้าออกจากตะกร้า
  const handleRemoveFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const resetAll = () => {
    setCart([]);
    setSelectedId("");
    setQuantity("");
  };

  // ยืนยันการขายทั้งตะกร้า
  const handleConfirmSale = async () => {
    setErrorMsg("");
    setSuccessMsg("");

    if (cart.length === 0) {
      setErrorMsg("ยังไม่มีสินค้าในตะกร้า");
      return;
    }

    // ตรวจสอบจำนวนที่ต้องเป็นบวกทุกแถว
    const invalidItem = cart.find((item) => item.quantity <= 0);
    if (invalidItem) {
      setErrorMsg(`กรุณากรอกจำนวนของ "${invalidItem.name}" ให้ถูกต้อง`);
      return;
    }

    // ตรวจสอบ stock ล่าสุดอีกครั้งก่อนบันทึกจริง (กันกรณีข้อมูลเปลี่ยนระหว่างเลือก)
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

    // 1) บันทึกทุกรายการลงตาราง sales
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

    // 2) อัปเดต stock ของสินค้าทุกชิ้นในตะกร้า
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
    }

    setSuccessMsg(
      `ขายสำเร็จ ${cart.length} รายการ รวม ${grandTotal.toFixed(2)} บาท`
    );
    resetAll();
    fetchProducts();
    setSubmitting(false);
  };

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {/* สรุปยอดรวมตัวใหญ่ ไว้บนสุดให้เห็นชัดทั้งฝั่งผู้ขายและลูกค้า */}
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
          {/* ส่วนเพิ่มสินค้าลงตะกร้า */}
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

          {/* ตะกร้าสินค้า */}
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
