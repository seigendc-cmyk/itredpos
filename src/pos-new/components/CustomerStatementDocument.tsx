import type { CustomerStatementPayload } from '../services/customerCreditService';

interface CustomerStatementDocumentProps {
  statement: CustomerStatementPayload | null;
}

function money(value?: number): string {
  return `USD ${(value || 0).toFixed(2)}`;
}

export default function CustomerStatementDocument({ statement }: CustomerStatementDocumentProps) {
  if (!statement) return null;
  const customer = statement.customer;
  return (
    <section id="customer-statement-print-area" className="customer-statement-document">
      <header className="customer-statement-document__header">
        <div>
          <h1>Customer Statement</h1>
          <p>Demo Vendor</p>
          <p>Local/mock statement. No external posting or payment gateway.</p>
        </div>
        <div>
          <strong>Generated</strong>
          <span>{new Date(statement.generatedAt).toLocaleString()}</span>
          <span>By {statement.generatedBy}</span>
        </div>
      </header>

      <div className="customer-statement-document__grid">
        <div>
          <strong>Customer Details</strong>
          <span>{customer?.customerName || 'Customer'}</span>
          <span>{customer?.phone || customer?.whatsapp || 'No phone captured'}</span>
          <span>{customer?.billingAddress || customer?.deliveryAddress || 'No address captured'}</span>
        </div>
        <div>
          <strong>Statement Period</strong>
          <span>{statement.periodFrom || 'Start'} to {statement.periodTo || 'Today'}</span>
          <span>{statement.statementType}</span>
        </div>
      </div>

      <table className="customer-statement-document__table">
        <thead><tr><th>Account Summary</th><th>Amount</th></tr></thead>
        <tbody>
          <tr><td>Opening Balance</td><td>{money(statement.openingBalance)}</td></tr>
          <tr><td>Credit Sales</td><td>{money(statement.creditSales)}</td></tr>
          <tr><td>Payments</td><td>{money(statement.paymentsTotal)}</td></tr>
          <tr><td>Returns</td><td>{money(statement.returnsTotal)}</td></tr>
          <tr><td>Credit Notes</td><td>{money(statement.creditNotesTotal)}</td></tr>
          <tr><td>Adjustments</td><td>{money(statement.adjustmentsTotal)}</td></tr>
          <tr><td>Closing Balance</td><td>{money(statement.closingBalance)}</td></tr>
          <tr><td>Overdue Balance</td><td>{money(statement.overdueBalance)}</td></tr>
        </tbody>
      </table>

      <table className="customer-statement-document__table">
        <thead><tr>{['Date', 'Type', 'Reference', 'Debit', 'Credit', 'Balance', 'Staff', 'Notes'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
        <tbody>
          {statement.ledger.map((row) => (
            <tr key={row.id}>
              <td>{new Date(row.date).toLocaleDateString()}</td>
              <td>{row.type}</td>
              <td>{row.reference}</td>
              <td>{money(row.debit)}</td>
              <td>{money(row.credit)}</td>
              <td>{money(row.balance)}</td>
              <td>{row.staff}</td>
              <td>{row.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="customer-statement-document__table">
        <thead><tr><th>Ageing Bucket</th><th>Amount</th></tr></thead>
        <tbody>
          <tr><td>Current</td><td>{money(statement.ageing.current)}</td></tr>
          <tr><td>1-30 Days</td><td>{money(statement.ageing.overdue1)}</td></tr>
          <tr><td>31-60 Days</td><td>{money(statement.ageing.overdue2)}</td></tr>
          <tr><td>61-90 Days</td><td>{money(statement.ageing.overdue3)}</td></tr>
          <tr><td>91-120 Days</td><td>{money(statement.ageing.overdue4)}</td></tr>
          <tr><td>120+ Severe</td><td>{money(statement.ageing.severeOverdue)}</td></tr>
        </tbody>
      </table>

      <footer className="customer-statement-document__footer">
        <p>Please settle overdue balances promptly. Payment instructions placeholder: cash, mobile money, card, or bank transfer at branch.</p>
        <div><span>Prepared By</span><span>Received By</span><span>Customer Acknowledgement</span></div>
      </footer>
    </section>
  );
}
