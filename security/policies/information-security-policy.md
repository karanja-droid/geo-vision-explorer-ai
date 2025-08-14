# Information Security Policy

## 1. Purpose and Scope

### 1.1 Purpose
This Information Security Policy establishes the framework for protecting GeoMiner's information assets, ensuring compliance with international standards (ISO 27001), and meeting regulatory requirements across African mining jurisdictions.

### 1.2 Scope
This policy applies to:
- All employees, contractors, and third parties accessing GeoMiner systems
- All information assets including geological data, client information, and proprietary algorithms
- All technology infrastructure including cloud services, databases, and applications
- All business processes involving information handling

### 1.3 Regulatory Compliance
This policy ensures compliance with:
- **South Africa**: Protection of Personal Information Act (POPIA)
- **Nigeria**: Nigeria Data Protection Regulation (NDPR)
- **Ghana**: Data Protection Act, 2012
- **International**: ISO 27001, SOC 2 Type II

## 2. Information Classification

### 2.1 Classification Levels

#### 2.1.1 Public
- **Definition**: Information intended for public disclosure
- **Examples**: Marketing materials, public documentation, press releases
- **Handling**: No special protection required
- **Retention**: Indefinite

#### 2.1.2 Internal
- **Definition**: Information for internal business use
- **Examples**: Business processes, internal communications, policies
- **Handling**: Access restricted to employees and authorized contractors
- **Retention**: As per business requirements

#### 2.1.3 Confidential
- **Definition**: Sensitive business information requiring protection
- **Examples**: Client geological data, proprietary algorithms, financial information
- **Handling**: Access on need-to-know basis, encryption required
- **Retention**: As per contractual and regulatory requirements

#### 2.1.4 Restricted
- **Definition**: Highly sensitive information requiring maximum protection
- **Examples**: Authentication credentials, encryption keys, personal data
- **Handling**: Strict access controls, multi-factor authentication, audit logging
- **Retention**: Minimum required period, secure disposal

### 2.2 Data Handling Requirements

#### 2.2.1 Geological Data Protection
- All geological survey data classified as Confidential minimum
- Government geological data may require Restricted classification
- Cross-border transfer restrictions apply per local regulations
- Client consent required for data processing and storage location

#### 2.2.2 Personal Data Protection
- All personal data classified as Restricted
- Processing requires explicit consent or legal basis
- Data subject rights must be honored (access, correction, deletion)
- Breach notification within 72 hours to relevant authorities

## 3. Access Control

### 3.1 Authentication Requirements

#### 3.1.1 Multi-Factor Authentication (MFA)
- **Mandatory** for all user accounts
- **Required methods**: TOTP, SMS, or hardware tokens
- **Backup codes** must be securely stored
- **Administrative accounts** require additional authentication factors

#### 3.1.2 Password Policy
- **Minimum length**: 12 characters
- **Complexity**: Mix of uppercase, lowercase, numbers, and symbols
- **Rotation**: Every 90 days for privileged accounts
- **History**: Cannot reuse last 12 passwords
- **Storage**: Only hashed with bcrypt or equivalent

### 3.2 Authorization Framework

#### 3.2.1 Role-Based Access Control (RBAC)
- **Principle of least privilege** applied to all access grants
- **Role definitions**:
  - Administrator: Full system access and user management
  - Geologist: Project and site management, data analysis
  - Geophysicist: Advanced geophysical data analysis
  - Drilling Manager: Drilling operations and core sample management
  - QA/QC Specialist: Quality assurance and data validation
  - Environmental Officer: Environmental compliance and sustainability
  - Executive: High-level reporting and strategic decision-making

#### 3.2.2 Access Reviews
- **Quarterly reviews** of all user access rights
- **Annual certification** by data owners
- **Immediate revocation** upon role change or termination
- **Automated alerts** for dormant accounts (30+ days inactive)

### 3.3 Privileged Access Management

#### 3.3.1 Administrative Access
- **Just-in-time access** for administrative tasks
- **Session recording** for all privileged activities
- **Approval workflow** for elevated permissions
- **Time-limited access** with automatic expiration

#### 3.3.2 Service Accounts
- **Unique credentials** for each service
- **Regular rotation** of service account passwords
- **Monitoring** of service account usage
- **Documentation** of service account purposes

## 4. Data Protection

### 4.1 Encryption Standards

#### 4.1.1 Data at Rest
- **AES-256 encryption** for all stored data
- **Key management** using AWS KMS or equivalent
- **Database encryption** with Transparent Data Encryption (TDE)
- **File system encryption** for all storage volumes

#### 4.1.2 Data in Transit
- **TLS 1.3** for all web communications
- **VPN tunnels** for administrative access
- **API encryption** using HTTPS with certificate pinning
- **Email encryption** for sensitive communications

### 4.2 Data Residency and Sovereignty

#### 4.2.1 Geographic Requirements
- **South African data**: Stored in AWS Africa (Cape Town) region
- **Nigerian data**: Local storage or explicit consent for offshore
- **Ghanaian data**: Compliance with local data protection requirements
- **Cross-border transfers**: Only with adequate protection measures

#### 4.2.2 Cloud Provider Requirements
- **SOC 2 Type II** certification required
- **ISO 27001** certification required
- **Local data center presence** preferred
- **Data processing agreements** with clear data protection terms

### 4.3 Backup and Recovery

#### 4.3.1 Backup Requirements
- **Daily automated backups** of all critical data
- **Geographic distribution** across multiple regions
- **Encryption** of all backup data
- **Regular testing** of backup integrity and restoration

#### 4.3.2 Disaster Recovery
- **Recovery Time Objective (RTO)**: 4 hours for critical systems
- **Recovery Point Objective (RPO)**: 1 hour maximum data loss
- **Annual disaster recovery testing** with documented results
- **Business continuity plan** with clear roles and responsibilities

## 5. Security Monitoring and Incident Response

### 5.1 Security Monitoring

#### 5.1.1 Continuous Monitoring
- **24/7 security monitoring** using SIEM tools
- **Automated threat detection** with machine learning
- **Real-time alerting** for security events
- **Regular vulnerability assessments** and penetration testing

#### 5.1.2 Audit Logging
- **Comprehensive logging** of all system activities
- **Centralized log management** with secure storage
- **Log retention** for minimum 7 years
- **Regular log analysis** for security events

### 5.2 Incident Response

#### 5.2.1 Incident Classification
- **Critical**: Data breach, system compromise, service outage
- **High**: Attempted breach, malware detection, policy violation
- **Medium**: Suspicious activity, failed authentication attempts
- **Low**: Policy questions, security awareness issues

#### 5.2.2 Response Procedures
- **Immediate containment** within 1 hour of detection
- **Investigation** within 4 hours of incident
- **Notification** to affected parties within 24 hours
- **Post-incident review** within 1 week of resolution

### 5.3 Security Awareness and Training

#### 5.3.1 Training Requirements
- **Annual security training** for all personnel
- **Role-specific training** for privileged users
- **Phishing simulation** exercises quarterly
- **Security awareness updates** for new threats

#### 5.3.2 Training Topics
- Information classification and handling
- Password security and MFA usage
- Phishing and social engineering awareness
- Incident reporting procedures
- Regulatory compliance requirements

## 6. Vendor and Third-Party Management

### 6.1 Vendor Security Assessment

#### 6.1.1 Due Diligence Requirements
- **Security questionnaire** completion
- **Certification verification** (ISO 27001, SOC 2)
- **Penetration testing** results review
- **Data processing agreement** execution

#### 6.1.2 Ongoing Monitoring
- **Annual security reviews** of critical vendors
- **Incident notification** requirements
- **Right to audit** contractual provisions
- **Termination procedures** for security breaches

### 6.2 Cloud Service Providers

#### 6.2.1 Selection Criteria
- **Security certifications** (ISO 27001, SOC 2, FedRAMP)
- **Data residency** options in required jurisdictions
- **Encryption** capabilities and key management
- **Incident response** and notification procedures

#### 6.2.2 Configuration Management
- **Security hardening** of all cloud resources
- **Network segmentation** and access controls
- **Monitoring** and logging configuration
- **Regular security assessments** of cloud environments

## 7. Compliance and Governance

### 7.1 Regulatory Compliance

#### 7.1.1 POPIA Compliance (South Africa)
- **Lawful processing** basis documented
- **Data subject consent** mechanisms implemented
- **Data subject rights** request procedures
- **Cross-border transfer** safeguards in place

#### 7.1.2 NDPR Compliance (Nigeria)
- **Data controller registration** completed
- **Privacy policy** published and maintained
- **Breach notification** procedures established
- **Data protection officer** appointed

#### 7.1.3 ISO 27001 Alignment
- **Information Security Management System (ISMS)** implemented
- **Risk assessment** and treatment procedures
- **Internal audit** program established
- **Management review** processes defined

### 7.2 Governance Structure

#### 7.2.1 Security Committee
- **Chief Information Security Officer (CISO)** as chair
- **Representatives** from all business units
- **Quarterly meetings** to review security posture
- **Annual security strategy** development

#### 7.2.2 Policy Management
- **Annual policy review** and updates
- **Version control** and change management
- **Training** on policy changes
- **Exception handling** procedures

## 8. Enforcement and Sanctions

### 8.1 Policy Violations

#### 8.1.1 Investigation Process
- **Prompt investigation** of reported violations
- **Fair and impartial** investigation procedures
- **Documentation** of investigation findings
- **Corrective action** recommendations

#### 8.1.2 Disciplinary Actions
- **Verbal warning** for minor violations
- **Written warning** for repeated violations
- **Suspension** for serious violations
- **Termination** for severe or repeated violations

### 8.2 Legal and Regulatory Actions

#### 8.2.1 Breach Notification
- **Internal notification** within 1 hour
- **Regulatory notification** within 72 hours
- **Customer notification** as required by law
- **Public disclosure** if legally required

#### 8.2.2 Legal Compliance
- **Cooperation** with regulatory investigations
- **Evidence preservation** procedures
- **Legal counsel** engagement for serious incidents
- **Remediation** actions as required

## 9. Policy Review and Updates

### 9.1 Review Schedule
- **Annual comprehensive review** of entire policy
- **Quarterly updates** for regulatory changes
- **Ad-hoc updates** for significant security events
- **Stakeholder consultation** for major changes

### 9.2 Approval Process
- **CISO approval** for technical updates
- **Executive approval** for policy changes
- **Board approval** for strategic changes
- **Legal review** for regulatory compliance

---

**Document Information:**
- **Version**: 1.0
- **Effective Date**: January 14, 2025
- **Next Review**: January 14, 2026
- **Owner**: Chief Information Security Officer
- **Approved By**: Chief Executive Officer

**Document Classification**: Internal