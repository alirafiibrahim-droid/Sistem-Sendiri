"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BudgetItem, BudgetItemWithChildren } from "@/lib/types/database";

type BudgetEntityType = "program" | "project";

interface BudgetManagerProps {
  type: BudgetEntityType;
  entityId: string;
  canEdit: boolean;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
  }).format(value);
}

export default function BudgetManager({ type, entityId, canEdit }: BudgetManagerProps) {
  const [items, setItems] = useState<BudgetItemWithChildren[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [formType, setFormType] = useState<"induk" | "anak">("induk");
  const [formParentId, setFormParentId] = useState("");
  const [formName, setFormName] = useState("");
  const [formQuantity, setFormQuantity] = useState("");
  const [formUnitPrice, setFormUnitPrice] = useState("");
  const [formError, setFormError] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  const entityKey = type === "program" ? "program_id" : "project_id";

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/budget-items?${entityKey}=${entityId}`);
      const json = await res.json();
      if (json.success) setItems(json.data);
    } catch {}
    setLoading(false);
  }, [entityKey, entityId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const availableParents = useMemo(() => {
    const editingId = editingItem?.id;
    return items.filter(
      (i) =>
        i.id !== editingId &&
        Number(i.subtotal) === 0
    );
  }, [items, editingItem]);

  const totalBudget = useMemo(() => {
    return items.reduce((sum, induk) => {
      const value =
        induk.children && induk.children.length > 0
          ? induk.children.reduce((s, c) => s + Number(c.subtotal), 0)
          : Number(induk.subtotal);
      return sum + value;
    }, 0);
  }, [items]);

  const editingHasChildren = useMemo(() => {
    if (!editingItem) return false;
    return (editingItem as BudgetItemWithChildren).children?.length > 0;
  }, [editingItem]);

  const openCreate = () => {
    setEditingItem(null);
    setFormType("induk");
    setFormParentId("");
    setFormName("");
    setFormQuantity("");
    setFormUnitPrice("");
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (item: BudgetItem) => {
    const hasChildren =
      (item as BudgetItemWithChildren).children &&
      (item as BudgetItemWithChildren).children.length > 0;
    if (hasChildren) {
      setMessage({
        type: "error",
        text: "Induk pos yang memiliki anak pos tidak dapat diedit. Hapus seluruh anak pos terlebih dahulu.",
      });
      return;
    }
    setEditingItem(item);
    setFormType(item.parent_id ? "anak" : "induk");
    setFormParentId(item.parent_id || "");
    setFormName(item.name);
    setFormQuantity(String(item.quantity));
    setFormUnitPrice(String(item.unit_price));
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setFormError("");
  };

  const computedSubtotal = (Number(formQuantity) || 0) * (Number(formUnitPrice) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const name = formName.trim();
    if (!name) {
      setFormError("Nama pos wajib diisi.");
      return;
    }
    if (formType === "anak" && !formParentId) {
      setFormError("Pilih Induk Pos terlebih dahulu.");
      return;
    }

    const payload: Record<string, unknown> = {
      name,
      quantity: Number(formQuantity) || 0,
      unit_price: Number(formUnitPrice) || 0,
    };

    if (editingItem) {
      if (formType === "anak") payload.parent_id = formParentId;
      else if (editingItem.parent_id) payload.parent_id = null;
    } else {
      if (formType === "anak") payload.parent_id = formParentId;
    }

    setFormSaving(true);
    setMessage(null);

    try {
      const url = editingItem
        ? `/api/budget-items/${editingItem.id}`
        : "/api/budget-items";
      const res = await fetch(url, {
        method: editingItem ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          [entityKey]: entityId,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setFormError(json.error?.message || "Gagal menyimpan pos anggaran.");
        setFormSaving(false);
        return;
      }
      setShowForm(false);
      setEditingItem(null);
      setMessage({ type: "success", text: "Pos anggaran berhasil disimpan." });
      fetchItems();
    } catch {
      setFormError("Gagal terhubung ke server.");
    }
    setFormSaving(false);
  };

  const handleDelete = async (item: BudgetItem) => {
    const hasChildren =
      (item as BudgetItemWithChildren).children &&
      (item as BudgetItemWithChildren).children.length > 0;
    const childCount = (item as BudgetItemWithChildren).children?.length || 0;
    const text = hasChildren
      ? `Hapus induk pos "${item.name}"? Seluruh nilai anggaran beserta ${childCount} anak pos di dalamnya akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.`
      : `Yakin ingin menghapus pos "${item.name}"?`;
    if (!confirm(text)) return;

    setMessage(null);
    try {
      const res = await fetch(`/api/budget-items/${item.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: "success", text: "Pos anggaran berhasil dihapus." });
        fetchItems();
      } else {
        setMessage({ type: "error", text: json.error?.message || "Gagal menghapus pos anggaran." });
      }
    } catch {
      setMessage({ type: "error", text: "Gagal terhubung ke server." });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Anggaran</h3>
          <p className="text-sm text-muted-foreground">
            Buat pos anggaran untuk program kerja ini
          </p>
        </div>
        {canEdit && !showForm && (
          <Button variant="outline" onClick={openCreate}>
            + Tambah Pos
          </Button>
        )}
      </div>

      {message && (
        <p className={`text-sm ${message.type === "success" ? "text-green-500" : "text-red-500"}`}>
          {message.text}
        </p>
      )}

      {/* Form Tambah/Edit Pos */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingItem ? "Edit Pos Anggaran" : "Tambah Pos Anggaran"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Jenis Pos <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formType}
                  disabled={editingHasChildren}
                  onChange={(e) => {
                    setFormType(e.target.value as "induk" | "anak");
                    setFormParentId("");
                  }}
                >
                  <option value="induk">Induk Pos</option>
                  <option value="anak">Anak Pos</option>
                </Select>
                {editingHasChildren && (
                  <p className="text-xs text-muted-foreground">
                    Induk pos yang memiliki anak pos tidak dapat diubah menjadi anak pos.
                  </p>
                )}
              </div>

              {formType === "anak" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Induk Pos <span className="text-red-500">*</span>
                  </label>
                  <Select value={formParentId} onChange={(e) => setFormParentId(e.target.value)}>
                    <option value="">Pilih induk pos...</option>
                    {availableParents.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                  {availableParents.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Belum ada Induk Pos yang dapat dijadikan wadah. Buat Induk Pos tanpa besar anggaran terlebih dahulu.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Nama Pos <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="Contoh: Konsumsi Panitia"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Jumlah</label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Contoh: 50"
                    disabled={editingHasChildren}
                    value={editingHasChildren ? "0" : formQuantity}
                    onChange={(e) => setFormQuantity(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nilai Anggaran (Rp)</label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Contoh: 15000"
                    disabled={editingHasChildren}
                    value={editingHasChildren ? "0" : formUnitPrice}
                    onChange={(e) => setFormUnitPrice(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Sub Total</label>
                <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm font-semibold">
                  {formatCurrency(computedSubtotal)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Sub Total = Jumlah &times; Nilai Anggaran
                </p>
              </div>

              {formError && <p className="text-sm text-red-500">{formError}</p>}

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={formSaving}>
                  {formSaving ? "Menyimpan..." : "Simpan"}
                </Button>
                <Button type="button" variant="outline" onClick={closeForm}>
                  Batal
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Daftar Pos */}
      <Card>
        <CardContent className="p-0">
          {items.some((i) => i.children && i.children.length > 0) && (
            <p className="px-4 pt-4 text-xs text-muted-foreground">
              Induk pos yang memiliki anak pos tidak dapat diedit. Untuk mengeditnya, hapus seluruh
              anak pos terlebih dahulu.
            </p>
          )}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Memuat anggaran...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Belum ada pos anggaran. Klik tambah pos untuk membuat anggaran.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Pos</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-right">Nilai Anggaran</TableHead>
                  <TableHead className="text-right">Sub Total</TableHead>
                  {canEdit && <TableHead className="w-24"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((induk) => {
                  const hasChildren = induk.children && induk.children.length > 0;
                  const indukAmount = hasChildren
                    ? induk.children.reduce((s, c) => s + Number(c.subtotal), 0)
                    : Number(induk.subtotal);
                  return (
                    <Fragment key={induk.id}>
                      <TableRow className={hasChildren ? "bg-muted/30" : ""}>
                        <TableCell className="font-medium">{induk.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">Induk Pos</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {hasChildren ? "—" : formatNumber(Number(induk.quantity))}
                        </TableCell>
                        <TableCell className="text-right">
                          {hasChildren ? "—" : formatCurrency(Number(induk.unit_price))}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(indukAmount)}
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              {hasChildren ? (
                                <span title="Induk pos yang memiliki anak pos tidak dapat diedit. Hapus anak pos terlebih dahulu untuk mengedit.">
                                  <Button variant="ghost" size="sm" disabled>
                                    Edit
                                  </Button>
                                </span>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEdit(induk)}
                                >
                                  Edit
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-700"
                                onClick={() => handleDelete(induk)}
                              >
                                Hapus
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                      {hasChildren &&
                        induk.children.map((child) => (
                          <TableRow key={child.id}>
                            <TableCell className="pl-10 text-muted-foreground">
                              └ {child.name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">Anak Pos</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(Number(child.quantity))}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(Number(child.unit_price))}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(Number(child.subtotal))}
                            </TableCell>
                            {canEdit && (
                              <TableCell>
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEdit(child)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:text-red-700"
                                    onClick={() => handleDelete(child)}
                                  >
                                    Hapus
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                    </Fragment>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="font-semibold">
                    Total Anggaran
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(totalBudget)}
                  </TableCell>
                  {canEdit && <TableCell />}
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
