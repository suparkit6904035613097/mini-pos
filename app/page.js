"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ProductsPage() {
  // รายการสินค้าทั้งหมด
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // ฟอร์มเพิ่มสินค้าใหม่
  const [form, setForm] = useState({
    sku: "",
    name: "",
    price: "",
    stock: "",
    unit: "",
  });

  // แถวที่กำลังแก้ไขแบบ inline (เก็บ id + ค่าที่กำลังแก้)
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // ดึงข้อมูลสินค้าจาก Supabase
  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMsg(error.message);
    } else {
      setProducts(data);
      setErrorMsg("");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // จัดการค่าฟอร์มเพิ่มสินค้าใหม่
  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // เพิ่มสินค้าใหม่ลงตาราง products
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!form.sku || !form.name) {
      setErrorMsg("กรุณากรอก SKU และชื่อสินค้า");
      return;
    }

    const { error } = await supabase.from("products").insert([
      {
        sku: form.sku,
        name: form.name,
        price: parseFloat(form.price) || 0,
        stock: parseInt(form.stock, 10) || 0,
        unit: form.unit,
      },
    ]);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setForm({ sku: "", name: "", price: "", stock: "", unit: "" });
    fetchProducts();
  };

  // ลบสินค้า
  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("ยืนยันการลบสินค้านี้?");
    if (!confirmDelete) return;

    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    fetchProducts();
  };

  // เริ่มแก้ไขแถว (โหลดค่าปัจจุบันเข้า editForm)
  const startEdit = (product) => {
    setEditingId(product.id);
    setEditForm({
      sku: product.sku,
      name: product.name,
      price: product.price,
      stock: product.stock,
      unit: product.unit,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  // บันทึกการแก้ไขสินค้า
  const handleSaveEdit = async (id) => {
    const { error } = await supabase
      .from("products")
      .update({
        sku: editForm.sku,
        name: editForm.name,
        price: parseFloat(editForm.price) || 0,
        stock: parseInt(editForm.stock, 10) || 0,
        unit: editForm.unit,
      })
      .eq("id", id);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setEditingId(null);
    setEditForm({});
    fetchProducts();
  };

  return (
    <div>
      <h1>รายการสินค้า</h1>

      {errorMsg && (
        <p style={{ color: "red", fontWeight: "bold" }}>{errorMsg}</p>
      )}

      {/* ฟอร์มเพิ่มสินค้าใหม่ */}
      <div className="card">
        <h2>เพิ่มสินค้าใหม่</h2>
        <form
          onSubmit={handleAddProduct}
          style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
        >
          <input
            name="sku"
            placeholder="SKU"
            value={form.sku}
            onChange={handleFormChange}
          />
          <input
            name="name"
            placeholder="ชื่อสินค้า"
            value={form.name}
            onChange={handleFormChange}
          />
          <input
            name="price"
            type="number"
            step="0.01"
            placeholder="ราคา"
            value={form.price}
            onChange={handleFormChange}
          />
          <input
            name="stock"
            type="number"
            placeholder="คงเหลือ"
            value={form.stock}
            onChange={handleFormChange}
          />
          <input
            name="unit"
            placeholder="หน่วย"
            value={form.unit}
            onChange={handleFormChange}
          />
          <button type="submit">เพิ่มสินค้า</button>
        </form>
      </div>

      {/* ตารางแสดงรายการสินค้า */}
      {loading ? (
        <p>กำลังโหลดข้อมูล...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>ชื่อสินค้า</th>
              <th>ราคา</th>
              <th>คงเหลือ</th>
              <th>หน่วย</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                {editingId === p.id ? (
                  // โหมดแก้ไขแบบ inline
                  <>
                    <td>
                      <input
                        name="sku"
                        value={editForm.sku}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td>
                      <input
                        name="name"
                        value={editForm.name}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td>
                      <input
                        name="price"
                        type="number"
                        step="0.01"
                        value={editForm.price}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td>
                      <input
                        name="stock"
                        type="number"
                        value={editForm.stock}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td>
                      <input
                        name="unit"
                        value={editForm.unit}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => handleSaveEdit(p.id)}>
                        บันทึก
                      </button>
                      <button onClick={cancelEdit}>ยกเลิก</button>
                    </td>
                  </>
                ) : (
                  // โหมดแสดงผลปกติ
                  <>
                    <td>{p.sku}</td>
                    <td>{p.name}</td>
                    <td>{p.price}</td>
                    <td>{p.stock}</td>
                    <td>{p.unit}</td>
                    <td style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => startEdit(p)}>แก้ไข</button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        style={{ backgroundColor: "#e33" }}
                      >
                        ลบ
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: "center" }}>
                  ยังไม่มีสินค้าในระบบ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
