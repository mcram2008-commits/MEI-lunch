import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mailgun';

export async function POST(request: Request) {
  try {
    const { 
      type, // 'overdue' | 'duplicate' | 'request'
      studentName, 
      studentId, 
      studentRoll,
      studentClass,
      advisorEmail,
      passDetails 
    } = await request.json();

    let subject = '';
    let text = '';
    let html = '';

    if (type === 'overdue') {
      subject = `⚠️ SECURITY ALERT: Student Overdue - ${studentName}`;
      text = `
        Student ${studentName} (${studentRoll}) from ${studentClass} has NOT returned to the hostel.
        Pass ID: ${passDetails.id}
        Expected Return Time: ${passDetails.endTime}
        Current Status: Scanned Out at ${new Date(passDetails.scannedOutAt).toLocaleTimeString()}
        
        Please take immediate action.
      `;
      html = `
        <div style="font-family: sans-serif; padding: 20px; border: 2px solid #ef4444; border-radius: 10px;">
          <h2 style="color: #ef4444;">🚨 Security Alert: Student Overdue</h2>
          <p><strong>Student:</strong> ${studentName} (${studentRoll})</p>
          <p><strong>Class/Year:</strong> ${studentClass}</p>
          <p><strong>Pass Type:</strong> ${passDetails.type.toUpperCase()}</p>
          <p><strong>Expected Return:</strong> ${passDetails.endTime}</p>
          <p><strong>Scanned Out At:</strong> ${new Date(passDetails.scannedOutAt).toLocaleTimeString()}</p>
          <hr />
          <p style="color: #666; font-style: italic;">This student has exceeded the return deadline without checking back into the hostel.</p>
        </div>
      `;
    } else if (type === 'duplicate') {
      subject = `🚩 GATE AUDIT: Duplicate Pass Attempt - ${studentName}`;
      text = `
        Audit Alert: Student ${studentName} (${studentRoll}) from ${studentClass} is attempting to apply for a second pass on the same day (${passDetails.date}).
        
        Pass 1: ${passDetails.existingPass.type} (${passDetails.existingPass.startTime}-${passDetails.existingPass.endTime})
        New Attempt: ${passDetails.newPass.type} (${passDetails.newPass.startTime}-${passDetails.newPass.endTime})
        
        This might indicate a bypass attempt.
      `;
      html = `
        <div style="font-family: sans-serif; padding: 20px; border: 2px solid #f59e0b; border-radius: 10px;">
          <h2 style="color: #f59e0b;">🚩 Audit Alert: Duplicate Pass Attempt</h2>
          <p><strong>Student:</strong> ${studentName} (${studentRoll})</p>
          <p><strong>Class/Year:</strong> ${studentClass}</p>
          <p><strong>Date:</strong> ${passDetails.date}</p>
          <hr />
          <p><strong>Existing Pass:</strong> ${passDetails.existingPass.type.toUpperCase()} (${passDetails.existingPass.startTime} - ${passDetails.existingPass.endTime})</p>
          <p><strong>New Request:</strong> ${passDetails.newPass.type.toUpperCase()} (${passDetails.newPass.startTime} - ${passDetails.newPass.endTime})</p>
          <hr />
          <p style="color: #666;">Multiple pass applications on the same day have been flagged for your review.</p>
        </div>
      `;
    } else {
      // Default: Pass Request
      subject = `Pass Request: ${passDetails.type.toUpperCase()} - ${studentName}`;
      text = `
        Student ${studentName} (${studentId}) has requested a ${passDetails.type} pass.
        Date: ${passDetails.date}
        Time: ${passDetails.startTime}
        Reason: ${passDetails.reason || 'N/A'}
      `;
      html = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #1e3a8a; border-radius: 10px;">
          <h2 style="color: #1e3a8a;">New Pass Request</h2>
          <p><strong>Student:</strong> ${studentName} (${studentId})</p>
          <p><strong>Type:</strong> ${passDetails.type.toUpperCase()}</p>
          <p><strong>Date:</strong> ${passDetails.date}</p>
          <p><strong>Time:</strong> ${passDetails.startTime}</p>
          <p><strong>Reason:</strong> ${passDetails.reason || 'N/A'}</p>
        </div>
      `;
    }

    // If no advisorEmail is provided, fallback to the main email
    const toEmail = advisorEmail || "mcram2008@gmail.com";

    const result = await sendEmail({
      to: toEmail,
      subject,
      text,
      html,
    });

    if (result.success) {
      return NextResponse.json({ message: 'Email sent successfully' });
    } else {
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
