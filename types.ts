
export interface Variation {
  id: string;
  colorId: string;
  size: string;
  stock: number;
  minStock: number;
  costPrice: number;
  salePrice: number;
  unit: string;
  image?: string;
  gridId?: string;
}

export interface GridDistribution {
  id: string;
  name: string;
  quantities: Record<string, number>; // Ex: {"35": 2, "36": 4...}
}

export interface AppGrid {
  id: string;
  name: string;
  sizes: string[];
  distributions?: GridDistribution[];
}

export interface WholesaleStockItem {
  id: string;
  product_id?: string; // Adicionado para rastreamento preciso
  colorId: string;
  gridId: string;
  distributionId: string;
  boxes: number;
  costPricePerBox: number;
  salePricePerBox: number;
  image?: string;
}

export interface Product {
  id: string;
  reference: string;
  name?: string;
  supplierId: string;
  gridId?: string;
  gridIds?: string[];
  status: 'active' | 'inactive';
  variations: Variation[];
  wholesaleStock: WholesaleStockItem[];
  image?: string;
  hasRetail: boolean;
  hasWholesale: boolean;
}

export interface AppColor {
  id: string;
  name: string;
}

export interface AppUnit {
  id: string;
  name: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
}

export type Category = ExpenseCategory;

export interface Customer {
  id: string;
  name: string;
  phone: string;
  balance: number;
  address?: string;
}

export interface Transaction {
  id: string;
  date: string;
  type: 'sale' | 'payment' | 'adjustment' | 'purchase' | 'expense_payment';
  amount: number;
  description: string;
  relatedId?: string;
  bankAccountId?: string;
}

export interface BankAccount {
  id: string;
  name: string;
  balance: number;
  created_at?: string;
}

export interface AccountTransfer {
  id: string;
  date: string;
  fromAccountId?: string; // If undefined, comes from "Cash"
  toAccountId?: string;   // If undefined, goes to "Cash"
  amount: number;
  description?: string;
  created_at?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  balance: number;
  type: 'Estoque' | 'Geral';
  phone?: string;
  email?: string;
  categoryId?: string;
}

export interface SaleItem {
  productId: string;
  variationId?: string;
  distributionId?: string;
  isWholesale: boolean;
  colorId?: string;
  quantity: number;
  priceAtSale: number;
}

export interface CartItem extends SaleItem {
  name: string;
  variationName: string;
  price: number;
  image?: string;
}

export type SaleStatus = 'Pendente' | 'Aguardando Aprovação' | 'Aguardando Estoque' | 'Aguardando Rota' | 'Entregue' | 'Cancelada' | 'Em produção' | 'Coletado';


export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  note?: string;
}

export interface Sale {
  id: string;
  saleNumber: string;
  date: string;
  dueDate: string;
  customerId: string;
  totalValue: number;
  amountPaid: number;
  isPaid: boolean;
  paymentType: 'cash' | 'credit';
  status: SaleStatus;
  items: SaleItem[];
  discount?: number;
  deliveryMethod?: 'pickup' | 'delivery';
  deliveryAddress?: string;
  comments?: string;
  privateNotes?: string;
  requiresApproval?: boolean;
  paymentHistory?: PaymentRecord[];
  bankAccountId?: string;
  categoryId?: string;
  releaseHistory?: { date: string; items: SaleItem[]; saleNumber: string }[];
}

export interface PurchaseItem {
  productId: string;
  variationId?: string;
  distributionId?: string;
  isWholesale: boolean;
  colorId?: string;
  quantity: number;
  costPrice: number;
  size?: string;
  notes?: string;
}

export interface ExpenseItem {
  id: string;
  description: string;
  value: number;
  category?: string;
  notes?: string;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  type: 'inventory' | 'general';
  isWholesale?: boolean;
  supplierId: string;
  date: string;
  dueDate: string;
  totalValue: number;
  amountPaid: number;
  isPaid: boolean;
  itemDescription?: string;
  notes?: string;
  items?: PurchaseItem[];
  expenseItems?: ExpenseItem[];
  paymentHistory?: PaymentRecord[];
  accounted?: boolean;
  bankAccountId?: string;
  categoryId?: string;
  cheques?: Cheque[];
  status?: SaleStatus;
}

export interface Cheque {
  id: string;
  number: string;
  purchaseId: string;
  supplierId: string;
  amount: number;
  dueDate: string;
  isPaid: boolean;
  created_at?: string;
}

export interface ReceiptItem extends PurchaseItem {
  // Same structure as PurchaseItem but for Receipts
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  type: 'inventory' | 'general';
  isWholesale?: boolean;
  customerId: string;
  date: string;
  dueDate: string;
  totalValue: number;
  amountPaid?: number;
  isPaid: boolean;
  items?: ReceiptItem[];
  expenseItems?: ExpenseItem[];
  itemDescription?: string;
  notes?: string;
  paymentHistory?: PaymentRecord[];
  accounted?: boolean;
  bankAccountId?: string;
  categoryId?: string;
  status?: SaleStatus;
}

export interface AccountEntry {
  id: string;
  type: 'payable' | 'receivable';
  description: string;
  value: number;
  dueDate: string;
  isPaid: boolean;
  relatedId?: string;
}

export interface AgendaTask { id: string; date: string; hour: string; title: string; completed: boolean; }
export interface AppNote { id: string; title: string; content: string; color: string; date: string; }

export type ViewType = 'dashboard' | 'vender' | 'vendas' | 'compras' | 'recebimentos' | 'produtos' | 'cadastros' | 'financeiro' | 'financeiro_pessoal' | 'financeiro_pessoal_relatorios' | 'backup' | 'estoque' | 'relatorios' | 'agenda' | 'relacionamento' | 'relacionamento_fornecedores' | 'clientes' | 'fornecedores';

// --- Personal Finance Types ---

export interface FamilyMember {
  id: string;
  name: string;
}

export interface PersonalCategory {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'reserve' | 'planning';
  parentId?: string; // If populated, it represents a subcategory
}

export interface PersonalBudget {
  id: string;
  categoryId: string;
  memberId?: string; // If populated, it is a budget specific to a member
  amount: number;
  month: string; // Format 'YYYY-MM'
}

export interface PersonalTransaction {
  id: string;
  date: string;
  type: 'income' | 'expense' | 'reserve' | 'planning';
  amount: number;
  description: string;
  categoryId?: string;
  memberId?: string;
  isPaid: boolean;
  businessTransactionId?: string; // For pro-labore links
  paymentMethod?: 'cash' | 'credit' | 'debit' | 'pix' | 'transfer';
  bank_account_id?: string;
}
