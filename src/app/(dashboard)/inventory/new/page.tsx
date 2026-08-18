"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inventoryItemFormSchema } from "@/lib/validations/inventory";
import type { WalletWithOwner, Bank, CashAccount } from "@/lib/types/database";

type FormErrors = Record<string, string>;

export default function NewInventoryItemPage() {
  const router = useRouter();
  const supabase = createSupabaseClient();

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const [name, setName] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [stock, setStock] = useState("1");
  const [condition, setCondition] = useState("GOOD");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  // Purchase fields (optional)
  const [includePurchase, setIncludePurchase] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaseUnitPrice, setPurchaseUnitPrice] = useState("");
  const [purchaseOtherCost, setPurchaseOtherCost] = useState("");
  const [purchaseSource, setPurchaseSource] = useState("");
  const [purchaseDesc, setPurchaseDesc] = useState("");
  const [walletsList, setWalletsList] = useState<WalletWithOwner[]>([]);
  const [banksList, setBanksList] = useState<Pick<Bank, "id" | "name" | "account_number">[]>([]);
  const [cashList, setCashList] = useState<Pick<CashAccount, "id" | "name">[]>([]);

  const purchaseTotal = (Number(stock) || 0) * (Number(purchaseUnitPrice) || 0) + (Number(purchaseOtherCost) || 0);

  useEffect(() => {
    Promise.all([fetch("/api/wallets"), fetch("/api/banks"), fetch("/api/cash")])
      .then(([wRes, bRes, cRes]) =>
        Promise.all([wRes.json(), bRes.json(), cRes.json()]).then(
          ([wJson, bJson, cJson]) => {
            if (wJson.success) setWalletsList(wJson.data);
            if (bJson.success) setBanksList(bJson.data);
            if (cJson.success) setCashList(cJson.data);
          }
        )
      );
  }, []);

  const bankIdsWithWallet = new Set(
    walletsList.filter((w) => w.bank_id).map((w) => w.bank_id as string)
  );
  const cashIdsWithWallet = new Set(
    walletsList.filter((w) => w.cash_account_id).map((w) => w.cash_account_id as string)
  );
  const banksWithoutWallet = banksList.filter((b) => !bankIdsWithWallet.has(b.id));
  const cashWithoutWallet = cashList.filter((c) => !cashIdsWithWallet.has(c.id));

  const validate = (): boolean => {
    const result = inventoryItemFormSchema.safeParse({
      name,
      category,
      stock: Number(stock),
      condition,
      location,
      description: description || undefined,
      photo_url: photoUrl || undefined,
    });

    if (!result.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setErrors({ _form: "Anda belum login." });
      setLoading(false);
      return;
    }

    // Create inventory item
    const { data: newItem, error: insertError } = await supabase
      .from("inventory_items")
      .insert({
        name,
        category,
        stock: Number(stock),
        unit_price: purchaseUnitPrice === "" ? 0 : Number(purchaseUnitPrice),
        condition,
        location,
        description: description || "",
        photo_url: photoUrl || null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (insertError) {
      setErrors({ _form: insertError.message });
      setLoading(false);
      return;
    }

    // If purchase data is provided, create purchase record
    if (includePurchase && purchaseDate && purchaseUnitPrice && purchaseSource && purchaseTotal > 0) {
      let walletId = "";
      let bankId = "";
      let cashAccountId = "";
      if (purchaseSource.startsWith("bank:")) {
        bankId = purchaseSource.replace("bank:", "");
      } else if (purchaseSource.startsWith("cash:")) {
        cashAccountId = purchaseSource.replace("cash:", "");
      } else if (purchaseSource) {
        walletId = purchaseSource;
      }

      const purchaseRes = await fetch(`/api/inventory/${newItem.id}/purchases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: purchaseTotal,
          date: purchaseDate,
          wallet_id: walletId || undefined,
          bank_id: bankId || undefined,
          cash_account_id: cashAccountId || undefined,
          description: purchaseDesc || undefined,
        }),
      });

      if (!purchaseRes.ok) {
        const purchaseJson = await purchaseRes.json();
        setErrors({ _form: "Barang berhasil dibuat, tapi gagal menyimpan pembelian: " + (purchaseJson.error?.message || "Unknown error") });
        setLoading(false);
        return;
      }
    }

    router.push(`/inventory/${newItem.id}`);
    router.refresh();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Barang Baru</h2>
        <p className="text-muted-foreground">Tambah barang inventaris baru</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Form Barang Inventaris</CardTitle>
          <CardDescription>Isi data di bawah untuk menambah barang baru</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nama Barang */}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="name">
                Nama Barang <span className="text-red-500">*</span>
              </label>
              <Input
                id="name"
                placeholder="Contoh: Laptop ASUS VivoBook 14"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>

            {/* Kategori & Kondisi */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="category">
                  Kategori <span className="text-red-500">*</span>
                </label>
                <Select value={category} onValueChange={(value) => setCategory(value)}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ELECTRONICS">Elektronik</SelectItem>
                    <SelectItem value="FURNITURE">Meubelair</SelectItem>
                    <SelectItem value="STATIONERY">ATK</SelectItem>
                    <SelectItem value="DOCUMENTS">Dokumen</SelectItem>
                    <SelectItem value="OTHER">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-sm text-red-500">{errors.category}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="condition">
                  Kondisi <span className="text-red-500">*</span>
                </label>
                <Select value={condition} onValueChange={(value) => setCondition(value)}>
                  <SelectTrigger id="condition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GOOD">Baik</SelectItem>
                    <SelectItem value="DAMAGED_LIGHT">Rusak Ringan</SelectItem>
                    <SelectItem value="DAMAGED_HEAVY">Rusak Berat</SelectItem>
                    <SelectItem value="LOST">Hilang</SelectItem>
                  </SelectContent>
                </Select>
                {errors.condition && <p className="text-sm text-red-500">{errors.condition}</p>}
              </div>
            </div>

            {/* Stok & Lokasi */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="stock">
                  Jumlah Stok <span className="text-red-500">*</span>
                </label>
                <Input
                  id="stock"
                  type="number"
                  min="1"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                />
                {errors.stock && <p className="text-sm text-red-500">{errors.stock}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="location">
                  Lokasi Penyimpanan <span className="text-red-500">*</span>
                </label>
                <Input
                  id="location"
                  placeholder="Contoh: Ruang Sekretariat"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
                {errors.location && <p className="text-sm text-red-500">{errors.location}</p>}
              </div>
            </div>

            {/* Deskripsi */}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="description">
                Deskripsi
              </label>
              <textarea
                id="description"
                placeholder="Deskripsi singkat barang..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
              {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
            </div>

            {/* URL Foto */}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="photo">
                URL Foto
              </label>
              <Input
                id="photo"
                type="url"
                placeholder="https://..."
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
              />
              {errors.photo_url && <p className="text-sm text-red-500">{errors.photo_url}</p>}
            </div>

            {/* ============================================================ */}
            {/* DATA PEMBELIAN (Opsional) */}
            {/* ============================================================ */}
            <div className="border-t pt-4 mt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePurchase}
                  onChange={(e) => setIncludePurchase(e.target.checked)}
                  className="rounded border-input"
                />
                <span className="text-sm font-medium">Sertakan Data Pembelian</span>
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                Centang untuk mencatat pembelian barang ini sekaligus
              </p>
            </div>

            {includePurchase && (
              <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="purchase-date">
                      Tanggal Pembelian <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="purchase-date"
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="purchase-unit-price">
                      Harga Satuan (Rp) <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="purchase-unit-price"
                      type="number"
                      min="1"
                      placeholder="0"
                      value={purchaseUnitPrice}
                      onChange={(e) => setPurchaseUnitPrice(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="purchase-other-cost">
                      Biaya Lainnya (Rp)
                    </label>
                    <Input
                      id="purchase-other-cost"
                      type="number"
                      min="0"
                      placeholder="0 (ongkir, dll)"
                      value={purchaseOtherCost}
                      onChange={(e) => setPurchaseOtherCost(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Total <span className="text-muted-foreground font-normal">(Stok &times; Harga Satuan + Biaya Lain)</span>
                    </label>
                    <Input
                      type="text"
                      readOnly
                      value={new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(purchaseTotal)}
                      className="bg-muted font-bold"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="purchase-source">
                    Sumber Dana <span className="text-red-500">*</span>
                  </label>
                  <Select value={purchaseSource === "" ? "__none__" : purchaseSource} onValueChange={(value) => setPurchaseSource(value === "__none__" ? "" : value)}>
                    <SelectTrigger id="purchase-source">
                      <SelectValue placeholder="Pilih sumber dana..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Pilih sumber dana...</SelectItem>
                      {banksWithoutWallet.length > 0 && (
                        <>
                          <SelectItem value="__bank_header__" disabled>Bank</SelectItem>
                          {banksWithoutWallet.map((b) => (
                            <SelectItem key={`bank-${b.id}`} value={`bank:${b.id}`}>{b.name} - {b.account_number}</SelectItem>
                          ))}
                        </>
                      )}
                      {cashWithoutWallet.length > 0 && (
                        <>
                          <SelectItem value="__cash_header__" disabled>Kas</SelectItem>
                          {cashWithoutWallet.map((c) => (
                            <SelectItem key={`cash-${c.id}`} value={`cash:${c.id}`}>{c.name}</SelectItem>
                          ))}
                        </>
                      )}
                      {walletsList.length > 0 && (
                        <>
                          <SelectItem value="__wallet_header__" disabled>Dompet</SelectItem>
                          {walletsList.map((w) => (
                            <SelectItem key={w.id} value={w.id}>{w.name} ({w.banks?.name || w.cash_accounts?.name || "-"})</SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="purchase-desc">
                    Deskripsi Pembelian
                  </label>
                  <Input
                    id="purchase-desc"
                    placeholder="Contoh: Pembelian 2 unit laptop untuk divisi IT"
                    value={purchaseDesc}
                    onChange={(e) => setPurchaseDesc(e.target.value)}
                  />
                </div>
              </div>
            )}

            {errors._form && (
              <p className="text-sm text-red-500 text-center">{errors._form}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Menyimpan..." : includePurchase ? "Simpan Barang & Pembelian" : "Simpan Barang"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Batal
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
