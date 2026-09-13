"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function SellPage() {
  // รายการสินค้าทั้งหมด (สำหรับ dropdown)
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // สินค้าที่เลือก + จำนวนที่จะขาย
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState("");

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

  // หาสินค้าที่กำลังเลือกอยู่ (object เต็ม) จาก id
  const selectedProduct = products.find((p) => p.id === selectedId);

  // คำนวณยอดรวม = ราคา x จำนวน
  const qtyNumber = parseInt(quantity, 10) || 0;
  const totalPrice = selectedProduct ? selectedProduct.price * qtyNumber : 0;

  const resetForm = () => {
    setSelectedId("");
    setQuantity("");
  };

  const handleSell = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!selectedProduct) {
      setErrorMsg("กรุณาเลือกสินค้า");
      return;
    }
    if (qtyNumber <= 0) {
      setErrorMsg("กรุณากรอกจำนวนที่ต้องการขายให้ถูกต้อง");
      return;
    }
    // ตรวจสอบ stock เพียงพอหรือไม่
    if (qtyNumber > selectedProduct.stock) {
      setErrorMsg(
        `สินค้าคงเหลือไม่พอ (คงเหลือ ${selectedProduct.stock} ${selectedProduct.unit})`
      );
      return;
    }

    setSubmitting(true);

    // 1) บันทึกรายการขายลงตาราง sales
    const { error: saleError } = await supabase.from("sales").insert([
      {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity: qtyNumber,
        total_price: totalPrice,
        sold_at: new Date().toISOString(),
      },
    ]);

    if (saleError) {
      setErrorMsg(saleError.message);
      setSubmitting(false);
      return;
    }

    // 2) อัปเดต stock ในตาราง products ให้ลดลงตามจำนวนที่ขาย
    const newStock = selectedProduct.stock - qtyNumber;
    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", selectedProduct.id);

    if (updateError) {
      setErrorMsg(updateError.message);
      setSubmitting(false);
      return;
    }

    // สำเร็จ: แจ้งเตือน รีเซ็ตฟอร์ม และโหลดรายการสินค้าใหม่ (stock อัปเดต)
    setSuccessMsg(
      `ขายสำเร็จ: ${selectedProduct.name} x ${qtyNumber} รวม ${totalPrice.toFixed(
        2
      )} บาท`
    );
    resetForm();
    fetchProducts();
    setSubmitting(false);
  };

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {errorMsg && (
        <p style={{ color: "red", fontWeight: "bold" }}>{errorMsg}</p>
      )}
      {successMsg && (
        <p style={{ color: "green", fontWeight: "bold" }}>{successMsg}</p>
      )}

      {loading ? (
        <p>กำลังโหลดข้อมูลสินค้า...</p>
      ) : (
        <div className="card">
          <form
            onSubmit={handleSell}
            style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "360px" }}
          >
            {/* Dropdown เลือกสินค้า แสดงชื่อและราคา */}
            <div>
              <label htmlFor="product">สินค้า</label>
              <br />
              <select
                id="product"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="">-- เลือกสินค้า --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.price} บาท (คงเหลือ {p.stock} {p.unit})
                  </option>
                ))}
              </select>
            </div>

            {/* ช่องกรอกจำนวน */}
            <div>
              <label htmlFor="quantity">จำนวน</label>
              <br />
              <input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            {/* แสดงยอดรวมอัตโนมัติ */}
            <div>
              <strong>ยอดรวม: {totalPrice.toFixed(2)} บาท</strong>
            </div>

            <button type="submit" disabled={submitting}>
              {submitting ? "กำลังบันทึก..." : "ขาย"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
