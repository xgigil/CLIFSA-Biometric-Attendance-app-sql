import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getLeaveApplicationDetailAction } from "../../read-actions";
import { PrintButton } from "./print-button";
import { formatFormDate, formatDays, type ApplicationDetail } from "../../format";

// Path to the logo image file.
const LOGO_SRC: string | null = "/clifsa-logo.png";

const FONT = 'Calibri, Carlito, "Segoe UI", Arial, sans-serif';
const NARROW_FONT = '"Arial Narrow", "Liberation Sans Narrow", Arial, sans-serif';

// Used only when system_settings has NULL for a field.
const FALLBACKS = {
  company_name: "COOP LIFE GENERAL INSURANCE AND FINANCIAL SERVICE AGENCY (CLIFSA)",
  company_address: "CLIFSA Building, M.H. Del Pilar, Barangay 17, Cagayan de Oro City, Philippines",
  company_phones: "Tele/Fax: (088) 8565644 | Mobile: 0917 852 8609",
  company_email: "clifsa_cdo@yahoo.com",
  form_title: "LEAVE APPLICATION",
  signatory_name: "HENRY M. LOPEZ",
  signatory_title: "CEO",
};

function Row({
  label,
  value,
  labelWidth,
  bold,
  center,
}: {
  label: string;
  value?: string | null;
  labelWidth: string;
  bold?: boolean;
  center?: boolean;
}) {
  return (
    <div className="flex h-[5.5mm] items-end text-[9pt] leading-none">
      <span
        className={"shrink-0 " + (bold ? "font-bold" : "")}
        style={{ width: labelWidth }}
      >
        {label}
      </span>
      <span
        className={
          "min-w-0 flex-1 truncate border-b border-black pb-[0.4mm] " +
          (center ? "text-center" : "pl-[2mm]")
        }
      >
        {value || "\u00A0"}
      </span>
    </div>
  );
}

function FormCopy({ data }: { data: ApplicationDetail }) {
  const { leave, application, settings } = data;
  const s = {
    company_name: settings?.company_name || FALLBACKS.company_name,
    company_address: settings?.company_address || FALLBACKS.company_address,
    company_phones: settings?.company_phones || FALLBACKS.company_phones,
    company_email: settings?.company_email || FALLBACKS.company_email,
    form_title: settings?.form_title || FALLBACKS.form_title,
    signatory_name: settings?.signatory_name || FALLBACKS.signatory_name,
    signatory_title: settings?.signatory_title || FALLBACKS.signatory_title,
  };
  const contactLine = [s.company_phones, s.company_email ? `Email: ${s.company_email}` : ""]
    .filter(Boolean)
    .join(" | ");

  return (
    <div
      className="flex h-[135mm] w-full flex-col bg-white px-[5mm] pt-[2mm] text-black"
      style={{ fontFamily: FONT }}
    >
      {/* Header: */}
      <div className="flex items-stretch gap-[3mm]">
        {LOGO_SRC && (
          <img src={LOGO_SRC} alt="" className="h-[26mm] w-[32mm] shrink-0 object-contain" />
        )}
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div className="pt-[2mm] text-center leading-tight">
            <div
              className="text-[12.5pt] font-bold tracking-tight text-[#1a2fd0]"
              style={{ 
                fontFamily: NARROW_FONT, 
                letterSpacing: "-0.09em",
                transform: "scaleX(0.9)",
                transformOrigin: "center",
              }}
            >
              {s.company_name}
            </div>
            <div className="text-[9.5pt]">{s.company_address}</div>
            <div className="text-[9.5pt]">{contactLine}</div>
          </div>
          <div
            className="mb-[2mm] mr-[1mm] h-[3.5mm] bg-[#0a0ae6]"
            style={{ boxShadow: "0.8mm 0.8mm 0 #e6b800" }}
          />
        </div>
      </div>

      <div className="mt-[2mm] text-center text-[14pt] font-bold uppercase leading-none">
        {s.form_title}
      </div>

      {/* LN#, Name / Date Filed, Position / Dept */}
      <div className="mt-[2mm] grid grid-cols-[1fr_1.1fr] gap-x-[10mm] gap-y-[0.5mm]">
        <div />
        <div className="flex justify-end">
          <div className="flex h-[5.5mm] w-[40mm] items-end text-[9pt] leading-none">
            <span className="shrink-0 font-bold">LN#</span>
            <span className="ml-[2mm] min-w-0 flex-1 border-b border-black pb-[0.4mm] text-center">
              {leave.id}
            </span>
          </div>
        </div>

        <Row label="Name" bold labelWidth="14mm" value={application.applicant_name} />
        <Row
          label="Date Filed"
          bold
          center
          labelWidth="29mm"
          value={formatFormDate(application.date_filed)}
        />
        <Row label="Position" bold labelWidth="14mm" value={application.position} />
        <Row label="Dept/Sec" bold center labelWidth="29mm" value={application.department} />
      </div>

      {/* Type of Leave: */}
      <div className="mt-[3mm] flex items-center gap-[2mm] text-[9pt] leading-none">
        <span className="font-bold underline">Type of Leave:</span>
        <span className="flex h-[4.5mm] w-[5.5mm] items-center justify-center border border-black text-[9pt]">
          &#10003;
        </span>
        <span>{leave.leave_type_name}</span>
      </div>

      {/* Personal action / Leave request date */}
      <div className="mt-[4mm] grid grid-cols-[1fr_1.1fr] gap-x-[10mm]">
        <div>
          <div className="mb-[0.5mm] text-[9pt] font-bold leading-none underline">
            PERSONAL ACTION
          </div>
          <Row
            label="Beginning Balance"
            center
            labelWidth="30mm"
            value={formatDays(application.beginning_balance)}
          />
          <Row
            label="Leave Taken"
            center
            labelWidth="30mm"
            value={formatDays(application.leave_taken)}
          />
          <Row
            label="Allowable leave"
            center
            labelWidth="30mm"
            value={formatDays(application.allowable_leave)}
          />
        </div>
        <div>
          <div className="mb-[0.5mm] text-[9pt] font-bold leading-none underline">
            LEAVE REQUEST DATE
          </div>
          <Row label="FROM" center labelWidth="29mm" value={formatFormDate(leave.start_date)} />
          <Row label="TO" center labelWidth="29mm" value={formatFormDate(leave.end_date)} />
          <Row
            label="TOTAL # OF DAYS"
            center
            labelWidth="29mm"
            value={formatDays(application.leave_taken)}
          />
        </div>
      </div>

      {/* Reason(s): */}
      <div className="mt-[3.5mm]">
        <div className="text-[9pt] font-bold leading-none underline">REASON(S)</div>
        <div className="mt-[1mm] flex min-h-[5.5mm] items-end justify-center break-words border-b border-black pb-[0.4mm] text-center text-[8pt] leading-tight">
          {leave.note}
        </div>
        <div className="h-[5.5mm] border-b border-black" />
      </div>

      {/* Signatures: employee | blank | signatory */}
      <div className="mt-auto grid grid-cols-3 gap-x-[12mm] pb-[2mm] text-[8pt] leading-none">
        <div>
          <div className="h-[5mm] border-b border-black" />
          <div className="pt-[1.5mm] text-center">EMPLOYEE SIGNATURE</div>
        </div>
        <div>
          <div className="h-[5mm] border-b border-black" />
        </div>
        <div>
          <div className="flex h-[5mm] items-end justify-center border-b border-black pb-[0.5mm]">
            {s.signatory_name}
          </div>
          <div className="pt-[1.5mm] text-center">{s.signatory_title}</div>
        </div>
      </div>
    </div>
  );
}

const PRINT_CSS = `
@page { size: A4 portrait; margin: 10mm; }
/* Without this, browsers drop background colors (the blue bar) when printing. */
#print-area, #print-area * {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
@media print {
  /* Hide everything (sidebar, header, buttons) except the sheet. */
  body * { visibility: hidden; }
  #print-area, #print-area * { visibility: visible; }
  #print-area { position: absolute; left: 0; top: 0; width: 100%; }
}
`;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PrintLeaveApplicationPage({ params }: PageProps) {
  const { id } = await params;
  const leaveId = parseInt(id, 10);

  const res = await getLeaveApplicationDetailAction(leaveId);
  if (!res.success || !res.data) {
    return (
      <div className="w-full my-6 px-6 space-y-3">
        <p className="text-sm text-red-500">{res.error || "Application not found."}</p>
        <Link href="/dashboard/leave-requests" className="text-sm underline">
          Back to applications
        </Link>
      </div>
    );
  }

  const data = res.data as ApplicationDetail;

  return (
    <div className="w-full my-6 px-6">
      <style>{PRINT_CSS}</style>

      <div className="mx-auto mb-4 flex max-w-[190mm] items-center justify-between">
        <Button variant="outline" asChild>
          <Link href={`/dashboard/leave-requests/${leaveId}`}>Back</Link>
        </Button>
        <PrintButton />
      </div>

      {/* Two identical copies on one A4 sheet */}
      <div id="print-area" className="mx-auto w-[190mm] max-w-full bg-white">
        <FormCopy data={data} />
        <div className="my-[2mm] border-t border-dashed border-gray-400" />
        <FormCopy data={data} />
      </div>
    </div>
  );
}