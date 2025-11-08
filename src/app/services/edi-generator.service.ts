import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class EdiGeneratorService {

  constructor() { }

  generate835(formData: any): string {
    const delimiter = formData.delimiter?.charAt(0) || '*';
    const segmentTerminator = formData.delimiter?.charAt(1) || '~';
    const currentDate = new Date();
    const interchangeControl = this.generateControlNumber(9);
    const groupControl = this.generateControlNumber(4);
    
    let segments: string[] = [];
    let segmentCount = 0;

    // ISA - Interchange Control Header
    segments.push(this.buildISA(delimiter, segmentTerminator, currentDate, interchangeControl));
    segmentCount++;

    // GS - Functional Group Header (HP for 835)
    segments.push(this.buildGS835(delimiter, segmentTerminator, currentDate, groupControl));
    segmentCount++;

    // ST - Transaction Set Header (835)
    const transactionControl = '0001';
    segments.push(this.buildST(delimiter, segmentTerminator, '835', transactionControl));
    segmentCount++;

    // BPR - Financial Information (Beginning segment for Payment Order/Remittance)
    segments.push(this.buildBPR(delimiter, segmentTerminator, formData));
    segmentCount++;

    // TRN - Reassociation Trace Number
    segments.push(this.buildTRN(delimiter, segmentTerminator));
    segmentCount++;

    // REF - Receiver Identification
    if (formData.provider?.npi) {
      segments.push(`REF${delimiter}EV${delimiter}${formData.provider.npi}${segmentTerminator}`);
      segmentCount++;
    }

    // DTM - Production Date
    segments.push(`DTM${delimiter}405${delimiter}${this.formatDateYYYYMMDD(currentDate)}${segmentTerminator}`);
    segmentCount++;

    // N1 Loop - Payer Identification
    segments.push(this.buildN1Loop(delimiter, segmentTerminator, 'PR', formData.insurance));
    segmentCount += 3; // N1, N3, N4

    // N1 Loop - Payee Identification
    segments.push(this.buildN1Loop(delimiter, segmentTerminator, 'PE', formData.provider));
    segmentCount += 3; // N1, N3, N4

    // LX - Header Number (Transaction Set Line Number)
    let lxNumber = 1;
    segments.push(`LX${delimiter}${lxNumber}${segmentTerminator}`);
    segmentCount++;

    // Process each claim
    if (formData.claims && formData.claims.length > 0) {
      formData.claims.forEach((claim: any, claimIndex: number) => {
        // CLP - Claim Payment Information
        const clpSegment = this.buildCLP(delimiter, segmentTerminator, claim);
        segments.push(clpSegment);
        segmentCount++;

        // CAS - Claim Level Adjustments (if any claim-level adjustments exist)
        if (claim.adjustment && parseFloat(claim.adjustment) !== 0) {
          segments.push(`CAS${delimiter}CO${delimiter}45${delimiter}${claim.adjustment}${segmentTerminator}`);
          segmentCount++;
        }

        // NM1 - Patient Name
        segments.push(this.buildNM1(delimiter, segmentTerminator, 'QC', formData.patient));
        segmentCount++;

        // NM1 - Insured Name (if different from patient)
        segments.push(this.buildNM1(delimiter, segmentTerminator, 'IL', formData.patient));
        segmentCount++;

        // NM1 - Corrected Patient/Insured Name (if applicable)
        segments.push(this.buildNM1(delimiter, segmentTerminator, '74', formData.provider));
        segmentCount++;

        // NM1 - Service Provider Name
        segments.push(this.buildNM1(delimiter, segmentTerminator, '82', formData.provider));
        segmentCount++;

        // REF - Other Claim Related Identification
        if (claim.claimNumber) {
          segments.push(`REF${delimiter}1K${delimiter}${claim.claimNumber}${segmentTerminator}`);
          segmentCount++;
        }

        // DTM - Statement Date
        if (claim.serviceDate) {
          const serviceDate = this.formatDateYYYYMMDD(new Date(claim.serviceDate));
          segments.push(`DTM${delimiter}232${delimiter}${serviceDate}${segmentTerminator}`);
          segmentCount++;
        }

        // Process service lines
        if (claim.serviceLines && claim.serviceLines.length > 0) {
          claim.serviceLines.forEach((serviceLine: any, lineIndex: number) => {
            // SVC - Service Payment Information
            const svcSegment = this.buildSVC(delimiter, segmentTerminator, serviceLine);
            segments.push(svcSegment);
            segmentCount++;

            // DTM - Service Line Date
            if (serviceLine.serviceDate) {
              const lineServiceDate = this.formatDateYYYYMMDD(new Date(serviceLine.serviceDate));
              segments.push(`DTM${delimiter}472${delimiter}${lineServiceDate}${segmentTerminator}`);
              segmentCount++;
            }

            // CAS - Service Line Adjustments
            if (serviceLine.claimAdjustments && serviceLine.claimAdjustments.length > 0) {
              serviceLine.claimAdjustments.forEach((adjustment: any) => {
                const casSegment = this.buildCAS(delimiter, segmentTerminator, adjustment);
                segments.push(casSegment);
                segmentCount++;
              });
            }

            // REF - Service Line Item Identification
            segments.push(`REF${delimiter}6R${delimiter}${lineIndex + 1}${segmentTerminator}`);
            segmentCount++;
          });
        }
      });
    }

    // PLB - Provider Level Adjustment (if applicable)
    if (formData.plb && formData.plb.adjustments && formData.plb.adjustments.length > 0) {
      const plbSegment = this.buildPLB(delimiter, segmentTerminator, formData);
      segments.push(plbSegment);
      segmentCount++;
    }

    // SE - Transaction Set Trailer
    segmentCount++; // Include SE itself
    segments.push(`SE${delimiter}${segmentCount}${delimiter}${transactionControl}${segmentTerminator}`);

    // GE - Functional Group Trailer
    segments.push(`GE${delimiter}1${delimiter}${groupControl}${segmentTerminator}`);

    // IEA - Interchange Control Trailer
    segments.push(`IEA${delimiter}1${delimiter}${interchangeControl}${segmentTerminator}`);

    return segments.join('\n');
  }

  private buildISA(delimiter: string, segmentTerminator: string, date: Date, controlNumber: string): string {
    return `ISA${delimiter}00${delimiter}          ${delimiter}00${delimiter}          ${delimiter}ZZ${delimiter}SUBMITTERID    ${delimiter}ZZ${delimiter}RECEIVERID     ${delimiter}${this.formatDate(date)}${delimiter}${this.formatTime(date)}${delimiter}U${delimiter}00401${delimiter}${controlNumber}${delimiter}0${delimiter}P${delimiter}:${segmentTerminator}`;
  }

  private buildGS835(delimiter: string, segmentTerminator: string, date: Date, controlNumber: string): string {
    return `GS${delimiter}HP${delimiter}PAYERID${delimiter}RECEIVERID${delimiter}${this.formatDateYYYYMMDD(date)}${delimiter}${this.formatTime(date)}${delimiter}${controlNumber}${delimiter}X${delimiter}005010X221A1${segmentTerminator}`;
  }

  private buildST(delimiter: string, segmentTerminator: string, transactionType: string, controlNumber: string): string {
    return `ST${delimiter}${transactionType}${delimiter}${controlNumber}${delimiter}005010X221A1${segmentTerminator}`;
  }

  private buildBPR(delimiter: string, segmentTerminator: string, formData: any): string {
    // Calculate total payment from all claims
    let totalPayment = 0;
    if (formData.claims && formData.claims.length > 0) {
      formData.claims.forEach((claim: any) => {
        totalPayment += parseFloat(claim.payment || '0');
      });
    }

    const handlingCode = 'C'; // Payment accompanies remittance
    const paymentAmount = totalPayment.toFixed(2);
    const creditDebit = 'C'; // Credit
    const paymentMethod = 'ACH'; // ACH payment
    const paymentFormat = 'CCP'; // Cash Concentration/Disbursement Plus
    const dfiIdQualifier = '01'; // ABA routing number
    const dfiId = '000000000'; // Bank routing number
    const accountNumberQualifier = 'DA'; // Demand deposit
    const accountNumber = '0000000000'; // Bank account number
    const payerId = formData.insurance?.payerId || 'PAYERID';
    const originatingCompanyId = '1234567890';
    const checkIssueDate = this.formatDateYYYYMMDD(new Date());

    return `BPR${delimiter}I${delimiter}${paymentAmount}${delimiter}${creditDebit}${delimiter}${paymentMethod}${delimiter}${paymentFormat}${delimiter}${dfiIdQualifier}${delimiter}${dfiId}${delimiter}${accountNumberQualifier}${delimiter}${accountNumber}${delimiter}${payerId}${delimiter}${delimiter}${delimiter}${dfiIdQualifier}${delimiter}${dfiId}${delimiter}${accountNumberQualifier}${delimiter}${accountNumber}${delimiter}${checkIssueDate}${segmentTerminator}`;
  }

  private buildTRN(delimiter: string, segmentTerminator: string): string {
    const traceType = '1'; // Current Transaction Trace Numbers
    const checkNumber = this.generateControlNumber(12);
    const originatingCompanyId = '1234567890';
    
    return `TRN${delimiter}${traceType}${delimiter}${checkNumber}${delimiter}${originatingCompanyId}${segmentTerminator}`;
  }

  private buildN1Loop(delimiter: string, segmentTerminator: string, entityCode: string, data: any): string {
    let segments = '';
    const name = entityCode === 'PR' ? (data?.planName || 'PAYER NAME') : (data?.name || 'PROVIDER NAME');
    const idCode = entityCode === 'PR' ? (data?.payerId || '') : (data?.npi || '');
    
    // N1 - Name
    segments += `N1${delimiter}${entityCode}${delimiter}${name}`;
    if (idCode) {
      segments += `${delimiter}XX${delimiter}${idCode}`;
    }
    segments += `${segmentTerminator}\n`;
    
    // N3 - Address
    const address = data?.address || '123 MAIN ST';
    segments += `N3${delimiter}${address}${segmentTerminator}\n`;
    
    // N4 - City, State, ZIP
    const city = data?.city || 'ANYTOWN';
    const state = data?.state || 'ST';
    const zip = data?.zip || '12345';
    segments += `N4${delimiter}${city}${delimiter}${state}${delimiter}${zip}${segmentTerminator}`;
    
    return segments;
  }

  private buildCLP(delimiter: string, segmentTerminator: string, claim: any): string {
    const claimNumber = claim.claimNumber || 'CLM' + Date.now();
    const claimStatus = claim.claimStatus || '1'; // 1=Processed as Primary, 2=Processed as Secondary, etc.
    const totalCharge = parseFloat(claim.totalCharge || '0').toFixed(2);
    const paymentAmount = parseFloat(claim.payment || '0').toFixed(2);
    const patientResponsibility = parseFloat(claim.adjustment || '0').toFixed(2);
    const claimFilingIndicator = 'MB'; // Medicare Part B
    const payerClaimControlNumber = this.generateControlNumber(10);
    const facilityTypeCode = '11'; // Office
    const claimFrequency = '1'; // Original

    return `CLP${delimiter}${claimNumber}${delimiter}${claimStatus}${delimiter}${totalCharge}${delimiter}${paymentAmount}${delimiter}${patientResponsibility}${delimiter}${claimFilingIndicator}${delimiter}${payerClaimControlNumber}${delimiter}${facilityTypeCode}${delimiter}${claimFrequency}${segmentTerminator}`;
  }

  private buildNM1(delimiter: string, segmentTerminator: string, entityCode: string, data: any): string {
    let entityType = '2'; // Non-person entity (default)
    let lastName = '';
    let firstName = '';
    let middleName = '';
    let idCode = '';

    if (entityCode === 'IL' || entityCode === 'QC') {
      // Patient/Subscriber - Person
      entityType = '1';
      lastName = data?.lastName || '';
      firstName = data?.firstName || '';
      middleName = data?.middleName || '';
    } else if (entityCode === '85' || entityCode === '41' || entityCode === '82' || entityCode === '74') {
      // Provider - could be person or organization
      entityType = data?.name ? '2' : '1';
      if (entityType === '2') {
        lastName = data?.name || '';
      }
      idCode = data?.npi || '';
    } else if (entityCode === '40') {
      // Payer - Organization
      entityType = '2';
      lastName = data?.planName || '';
      idCode = data?.payerId || '';
    }

    let nm1 = `NM1${delimiter}${entityCode}${delimiter}${entityType}${delimiter}${lastName}`;
    
    if (entityType === '1') {
      nm1 += `${delimiter}${firstName}${delimiter}${middleName}`;
    } else {
      nm1 += delimiter + delimiter; // Empty first and middle name for organizations
    }
    
    nm1 += delimiter + delimiter; // Name suffix and ID qualifier
    
    if (idCode) {
      nm1 += `${delimiter}XX${delimiter}${idCode}`;
    }
    
    nm1 += segmentTerminator;
    return nm1;
  }

  private buildSVC(delimiter: string, segmentTerminator: string, serviceLine: any): string {
    const procedureCode = serviceLine.procedureCode || 'XXXXX';
    const chargeAmount = parseFloat(serviceLine.chargeAmount || '0').toFixed(2);
    const paidAmount = parseFloat(serviceLine.paidAmount || '0').toFixed(2);
    const revenueCode = ''; // Optional
    const units = serviceLine.units || '1';

    return `SVC${delimiter}HC:${procedureCode}${delimiter}${chargeAmount}${delimiter}${paidAmount}${delimiter}${revenueCode}${delimiter}${units}${segmentTerminator}`;
  }

  private buildCAS(delimiter: string, segmentTerminator: string, adjustment: any): string {
    const adjustmentCodeParts = adjustment.adjustmentCode?.split('-') || [];
    const groupCode = adjustmentCodeParts[0] || 'CO';
    const reasonCode = adjustmentCodeParts[1] || '45';
    const amount = parseFloat(adjustment.adjustmentAmount || '0').toFixed(2);
    
    return `CAS${delimiter}${groupCode}${delimiter}${reasonCode}${delimiter}${amount}${segmentTerminator}`;
  }

  private buildPLB(delimiter: string, segmentTerminator: string, formData: any): string {
    const providerId = formData.provider?.npi || 'PROVIDERID';
    const fiscalPeriodEnd = this.formatDateYYYYMMDD(new Date());
    
    let adjustments = '';
    if (formData.plb?.adjustments && formData.plb.adjustments.length > 0) {
      formData.plb.adjustments.forEach((adj: any, index: number) => {
        const adjustmentCode = adj.adjustmentCode || 'WO';
        const adjustmentId = adj.adjustmentId || '';
        const amount = parseFloat(adj.adjustmentAmount || '0').toFixed(2);
        
        adjustments += `${delimiter}${adjustmentCode}:${adjustmentId}${delimiter}${amount}`;
      });
    }

    return `PLB${delimiter}${providerId}${delimiter}${fiscalPeriodEnd}${adjustments}${segmentTerminator}`;
  }

  private generateControlNumber(length: number): string {
    return String(Math.floor(Math.random() * Math.pow(10, length))).padStart(length, '0');
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  private formatDateYYYYMMDD(date: Date): string {
    const year = date.getFullYear().toString();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  private formatTime(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}${minutes}`;
  }
}
