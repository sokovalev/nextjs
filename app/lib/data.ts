import { supabase } from "@/lib/supabase";
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
} from "./definitions";
import { formatCurrency } from "./utils";

export async function fetchRevenue() {
  try {
    const { data, error } = await supabase
      .from("revenue")
      .select("*")
      .order("month");

    if (error) throw error;
    return data as Revenue[];
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch revenue data.");
  }
}

export async function fetchLatestInvoices() {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select(
        `
        amount,
        customers (
          name,
          image_url,
          email
        ),
        id
      `
      )
      .order("date", { ascending: false })
      .limit(5);

    if (error) throw error;

    const latestInvoices = data.map((invoice) => ({
      id: invoice.id,
      amount: Number(invoice.amount),
      name: invoice.customers[0].name,
      email: invoice.customers[0].email,
      image_url: invoice.customers[0].image_url,
    }));

    return latestInvoices as LatestInvoiceRaw[];
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch the latest invoices.");
  }
}

export async function fetchCardData() {
  try {
    const [
      { count: invoiceCount },
      { count: customerCount },
      { data: invoiceStatus },
    ] = await Promise.all([
      supabase.from("invoices").select("*", { count: "exact", head: true }),
      supabase.from("customers").select("*", { count: "exact", head: true }),
      supabase.from("invoices").select("amount, status"),
    ]);

    const totalPaidInvoices = formatCurrency(
      invoiceStatus?.reduce(
        (acc, inv) => acc + (inv.status === "paid" ? inv.amount : 0),
        0
      ) ?? 0
    );
    const totalPendingInvoices = formatCurrency(
      invoiceStatus?.reduce(
        (acc, inv) => acc + (inv.status === "pending" ? inv.amount : 0),
        0
      ) ?? 0
    );

    return {
      numberOfCustomers: customerCount ?? 0,
      numberOfInvoices: invoiceCount ?? 0,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch card data.");
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const { data, error } = await supabase
      .from("invoices")
      .select(
        `
        id,
        amount,
        date,
        status,
        customer_id,
        customers (
          name,
          email,
          image_url
        )
      `
      )
      .or(
        `customers.name.ilike.%${query}%,customers.email.ilike.%${query}%,amount.ilike.%${query}%,date.ilike.%${query}%,status.ilike.%${query}%`
      )
      .order("date", { ascending: false })
      .range(offset, offset + ITEMS_PER_PAGE - 1);

    if (error) throw error;

    const invoices = data.map((invoice) => ({
      id: invoice.id,
      customer_id: invoice.customer_id,
      amount: invoice.amount,
      date: invoice.date,
      status: invoice.status,
      name: invoice.customers[0].name,
      email: invoice.customers[0].email,
      image_url: invoice.customers[0].image_url,
    }));

    return invoices as InvoicesTable[];
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoices.");
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const { count, error } = await supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .or(
        `customers.name.ilike.%${query}%,customers.email.ilike.%${query}%,amount.ilike.%${query}%,date.ilike.%${query}%,status.ilike.%${query}%`
      );

    if (error) throw error;
    const totalPages = Math.ceil((count ?? 0) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch total number of invoices.");
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select("id, customer_id, amount, status")
      .eq("id", id)
      .single();

    if (error) throw error;

    return {
      ...data,
      amount: data.amount / 100,
    } as InvoiceForm;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoice.");
  }
}

export async function fetchCustomers() {
  try {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name")
      .order("name");

    if (error) throw error;
    return data as CustomerField[];
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch all customers.");
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const { data, error } = await supabase
      .from("customers")
      .select(
        `
        id,
        name,
        email,
        image_url,
        invoices (
          id,
          amount,
          status
        )
      `
      )
      .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
      .order("name");

    if (error) throw error;

    const customers = data.map((customer) => {
      const totalPending =
        customer.invoices?.reduce(
          (acc, inv) => acc + (inv.status === "pending" ? inv.amount : 0),
          0
        ) ?? 0;
      const totalPaid =
        customer.invoices?.reduce(
          (acc, inv) => acc + (inv.status === "paid" ? inv.amount : 0),
          0
        ) ?? 0;

      return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        image_url: customer.image_url,
        total_invoices: customer.invoices?.length ?? 0,
        total_pending: totalPending,
        total_paid: totalPaid,
      };
    });

    return customers as CustomersTableType[];
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch customer table.");
  }
}
