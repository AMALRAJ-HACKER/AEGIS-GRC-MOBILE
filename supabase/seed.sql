
-- Seed Frameworks (demo labeled)
insert into frameworks (name, slug, version, description, category, is_demo) values
('ISO/IEC 27001:2022','iso27001','2022','Information security management systems','ISO', true),
('NIST Cybersecurity Framework 2.0','nist-csf','2.0','Govern, Identify, Protect, Detect, Respond, Recover','NIST', true),
('SOC 2 Trust Services Criteria','soc2','2017','Security, Availability, Processing Integrity, Confidentiality, Privacy','SOC', true),
('Digital Personal Data Protection Act, 2023','dpdp-act','2023','India DPDP Act obligations for Data Fiduciaries','Indian Law', true),
('CERT-In Directions 2022','cert-in','2022','Incident reporting, log retention, sync, contacts','Indian Regulation', true),
('RBI Cyber Security Framework for Banks','rbi-csf','2023','RBI requirements for Banks, NBFCs','Indian Regulation', true),
('UGC IT Guidelines','ugc-it','2023','University Grants Commission IT & data guidelines','Indian Regulation', true)
on conflict (slug) do nothing;

-- Sample controls for ISO
insert into framework_controls (framework_id, control_id, title, description, category, implementation_guidance)
select f.id, c.control_id, c.title, c.description, c.category, c.guidance from frameworks f,
(values
('A.5.1','Policies for information security','Management direction for information security','Governance','Document, approve, publish ISMS policies, review annually.'),
('A.5.31','Legal, statutory, regulatory and contractual requirements','Compliance with laws','Compliance','Maintain legal register including DPDP, CERT-In, RBI.'),
('A.8.10','Information deletion','Data retention and deletion','Data Protection','Define retention schedule and secure deletion per DPDP Sec 8.'),
('A.8.12','Data leakage prevention','Prevent unauthorized disclosure','Data Protection','DLP controls, classification, labeling.')
) as c(control_id, title, description, category, guidance)
where f.slug='iso27001'
on conflict (framework_id, control_id) do nothing;

-- DPDP controls
insert into framework_controls (framework_id, control_id, title, description, category, implementation_guidance)
select f.id, c.control_id, c.title, c.description, c.category, c.guidance from frameworks f,
(values
('DP-1','Notice and Consent','Provide clear notice and obtain verifiable consent per Sec 6','Consent','Publish privacy notice, maintain consent artifact, consent manager integration.'),
('DP-7','Retention and Erasure','Erase personal data when purpose fulfilled or consent withdrawn','Data Rights','Implement retention policy, automated purge, consent withdrawal workflow.'),
('DP-8','Data Principal Rights','Implement grievance redressal and rights handling','Data Rights','Rights portal, 7-day acknowledgment, logs.'),
('DP-12','Security Safeguards','Reasonable security safeguards per Sec 8(4)','Security','Encryption, access control, audit logs, breach notification to DPA within 72h.')
) as c(control_id, title, description, category, guidance)
where f.slug='dpdp-act'
on conflict (framework_id, control_id) do nothing;

-- Demo org and risk scoring note
-- risk scoring: inherent = likelihood*impact (1-25). Severity mapping: 1-4 Low, 5-9 Medium, 10-16 High, 17-25 Critical. Residual calculated similarly.
