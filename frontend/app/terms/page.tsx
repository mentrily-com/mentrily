import React from 'react';

export default function TermsOfService() {
    return (
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h1 className="text-4xl font-bold mb-8 text-[#0F172A]">Terms of Service</h1>

            <div className="prose prose-slate max-w-none text-[#475569]">
                <p className="mb-4 text-sm font-semibold text-slate-500">
                    Last updated: {new Date().toLocaleDateString()}
                </p>

                <p className="mb-6 leading-relaxed">
                    Welcome to Mentrily! These Terms of Service ("Terms") govern your access to and use of the Mentrily
                    platform, websites, services, and applications (collectively, the "Services"). Please read these
                    Terms carefully, as they form a binding legal agreement between you and Mentrily. By accessing or
                    using our Services, you agree to be bound by these Terms and all applicable laws and regulations. If
                    you do not agree with any of these Terms, you are prohibited from using or accessing this site.
                </p>

                <h2 className="text-2xl font-semibold mt-10 mb-4 text-[#0F172A]">1. Acceptance of Terms</h2>
                <p className="mb-4">
                    By registering for an account, accessing, or using the Services, you acknowledge that you have read,
                    understood, and agree to be bound by these Terms. If you are accepting these Terms on behalf of a
                    company, organization, or other legal entity, you represent and warrant that you have the authority
                    to bind such entity to these Terms.
                </p>

                <h2 className="text-2xl font-semibold mt-10 mb-4 text-[#0F172A]">2. Description of Service</h2>
                <p className="mb-4">
                    Mentrily provides a comprehensive SaaS platform enabling educators and organizations to build,
                    manage, and scale branded online schools, courses, exams, and certificates. We reserve the right to
                    modify, suspend, or discontinue any part of the Services at any time, with or without notice. We
                    shall not be liable to you or any third party for any modification, suspension, or discontinuance of
                    the Services.
                </p>

                <h2 className="text-2xl font-semibold mt-10 mb-4 text-[#0F172A]">3. Account Registration & Security</h2>
                <p className="mb-4">
                    To use certain features of the Service, you must register for an account. You agree to:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Provide accurate, current, and complete information during the registration process.</li>
                    <li>
                        Maintain and promptly update your account information to keep it accurate, current, and
                        complete.
                    </li>
                    <li>Maintain the security and confidentiality of your password and account credentials.</li>
                    <li>Accept responsibility for all activities that occur under your account.</li>
                    <li>
                        Immediately notify Mentrily of any unauthorized use of your account or any other breach of
                        security.
                    </li>
                </ul>

                <h2 className="text-2xl font-semibold mt-10 mb-4 text-[#0F172A]">
                    4. Subscriptions, Billing, and Payments
                </h2>
                <p className="mb-4">
                    Certain aspects of the Services are provided for a fee or other charge. If you elect to use paid
                    aspects of the Services, you agree to the pricing and payment terms as displayed on our pricing page
                    or otherwise communicated to you.
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>
                        <strong>Billing:</strong> Fees will be billed in advance on a recurring basis (e.g., monthly or
                        annually). You authorize us to charge your chosen payment provider.
                    </li>
                    <li>
                        <strong>Cancellations:</strong> You may cancel your subscription at any time. Cancellation will
                        take effect at the end of your current billing cycle.
                    </li>
                    <li>
                        <strong>Refunds:</strong> Except when required by law, paid subscription fees are
                        non-refundable.
                    </li>
                    <li>
                        <strong>Taxes:</strong> All fees are exclusive of applicable national, provincial, state, local
                        or other taxes. You are responsible for all applicable taxes.
                    </li>
                </ul>

                <h2 className="text-2xl font-semibold mt-10 mb-4 text-[#0F172A]">
                    5. User Content & Intellectual Property
                </h2>
                <p className="mb-4">
                    <strong>Your Content:</strong> You retain all ownership rights to the content, courses, materials,
                    and data you upload to the Mentrily platform ("User Content"). By uploading User Content, you grant
                    Mentrily a worldwide, non-exclusive, royalty-free license to host, copy, transmit, and display your
                    User Content solely as necessary for us to provide the Services.
                </p>
                <p className="mb-4">
                    <strong>Mentrily's Intellectual Property:</strong> The Services, including all software, design,
                    text, graphics, and trademarks, are owned by Mentrily and are protected by international copyright,
                    trademark, patent, trade secret, and other intellectual property laws. You may not copy, modify,
                    distribute, sell, or lease any part of our Services without explicit written permission.
                </p>

                <h2 className="text-2xl font-semibold mt-10 mb-4 text-[#0F172A]">
                    6. Acceptable Use and Prohibited Conduct
                </h2>
                <p className="mb-4">You agree not to use the Services to:</p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Violate any local, state, national, or international law or regulation.</li>
                    <li>
                        Upload or distribute content that is unlawful, defamatory, harassing, abusive, fraudulent, or
                        obscene.
                    </li>
                    <li>Infringe upon the intellectual property rights of any third party.</li>
                    <li>Distribute viruses, malware, or any other harmful code.</li>
                    <li>Attempt to reverse engineer, decompile, hack, or disable any part of the Services.</li>
                    <li>Spam, solicit, or phish users of the Services.</li>
                </ul>

                <h2 className="text-2xl font-semibold mt-10 mb-4 text-[#0F172A]">7. Third-Party Services</h2>
                <p className="mb-4">
                    The Services may contain links to third-party websites or services that are not owned or controlled
                    by Mentrily. Mentrily has no control over, and assumes no responsibility for, the content, privacy
                    policies, or practices of any third-party websites or services. You further acknowledge and agree
                    that Mentrily shall not be responsible or liable, directly or indirectly, for any damage or loss
                    caused by your use of any such third-party content or services.
                </p>

                <h2 className="text-2xl font-semibold mt-10 mb-4 text-[#0F172A]">8. Disclaimer of Warranties</h2>
                <p className="mb-4 uppercase font-semibold">
                    The services are provided on an "as is" and "as available" basis. Mentrily expressly disclaims all
                    warranties of any kind, whether express or implied, including, but not limited to, the implied
                    warranties of merchantability, fitness for a particular purpose, and non-infringement.
                </p>
                <p className="mb-4">
                    Mentrily makes no warranty that (i) the Services will meet your requirements, (ii) the Services will
                    be uninterrupted, timely, secure, or error-free, (iii) the results that may be obtained from the use
                    of the Services will be accurate or reliable, or (iv) the quality of any products, services,
                    information, or other material purchased or obtained by you through the Services will meet your
                    expectations.
                </p>

                <h2 className="text-2xl font-semibold mt-10 mb-4 text-[#0F172A]">9. Limitation of Liability</h2>
                <p className="mb-4 uppercase font-semibold">
                    In no event shall Mentrily, its directors, employees, partners, agents, suppliers, or affiliates, be
                    liable for any indirect, incidental, special, consequential, or punitive damages, including without
                    limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Your access to or use of or inability to access or use the Services;</li>
                    <li>Any conduct or content of any third party on the Services;</li>
                    <li>Any content obtained from the Services; and</li>
                    <li>Unauthorized access, use, or alteration of your transmissions or content.</li>
                </ul>

                <h2 className="text-2xl font-semibold mt-10 mb-4 text-[#0F172A]">10. Indemnification</h2>
                <p className="mb-4">
                    You agree to defend, indemnify, and hold harmless Mentrily and its licensee and licensors, and their
                    employees, contractors, agents, officers, and directors, from and against any and all claims,
                    damages, obligations, losses, liabilities, costs or debt, and expenses (including but not limited to
                    attorney's fees), resulting from or arising out of a) your use and access of the Service, by you or
                    any person using your account and password, or b) a breach of these Terms.
                </p>

                <h2 className="text-2xl font-semibold mt-10 mb-4 text-[#0F172A]">11. Termination</h2>
                <p className="mb-4">
                    We may terminate or suspend your account and bar access to the Services immediately, without prior
                    notice or liability, under our sole discretion, for any reason whatsoever and without limitation,
                    including but not limited to a breach of the Terms. If you wish to terminate your account, you may
                    simply discontinue using the Services.
                </p>

                <h2 className="text-2xl font-semibold mt-10 mb-4 text-[#0F172A]">
                    12. Governing Law and Dispute Resolution
                </h2>
                <p className="mb-4">
                    These Terms shall be governed and construed in accordance with the laws of the jurisdiction in which
                    Mentrily operates, without regard to its conflict of law provisions. Any dispute arising from these
                    Terms will be resolved through binding arbitration, rather than in court, except that you may assert
                    claims in small claims court if your claims qualify.
                </p>

                <h2 className="text-2xl font-semibold mt-10 mb-4 text-[#0F172A]">13. Changes to Terms</h2>
                <p className="mb-4">
                    We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a
                    revision is material, we will provide at least 30 days' notice prior to any new terms taking effect.
                    What constitutes a material change will be determined at our sole discretion. By continuing to
                    access or use our Services after any revisions become effective, you agree to be bound by the
                    revised terms.
                </p>

                <h2 className="text-2xl font-semibold mt-10 mb-4 text-[#0F172A]">14. Contact Information</h2>
                <p className="mb-4">
                    If you have any questions about these Terms, please contact us at support@mentrily.com.
                </p>
            </div>
        </main>
    );
}
