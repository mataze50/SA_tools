/**
 * SCORM Manifest Generator
 * Generates imsmanifest.xml for SCORM 1.2 and 2004 packages
 */

import { ScormExportConfig, ScormModuleData } from '../types/scorm.types';

/**
 * Generate SCORM 1.2 manifest
 */
export function generateScorm12Manifest(
  moduleData: ScormModuleData,
  files: string[],
  config: ScormExportConfig
): string {
  const identifier = sanitizeIdentifier(
    `HARMONIA_${moduleData.metadata.competenceCode}_${Date.now()}`
  );

  const resourceId = `RES_${sanitizeIdentifier(moduleData.metadata.competenceCode)}`;
  const itemId = `ITEM_${sanitizeIdentifier(moduleData.metadata.competenceCode)}`;
  const orgId = 'HARMONIA_ORG';

  const fileElements = files
    .map(f => `      <file href="${escapeXml(f)}"/>`)
    .join('\n');

  const keywords = moduleData.metadata.keywords.slice(0, 5);
  const keywordElements = keywords
    .map(k => `            <keyword><langstring xml:lang="${config.language}">${escapeXml(k)}</langstring></keyword>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${identifier}" version="1.0"
    xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
    xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                        http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd
                        http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">

  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
    <lom xmlns="http://www.imsglobal.org/xsd/imsmd_rootv1p2p1">
      <general>
        <title>
          <langstring xml:lang="${config.language}">${escapeXml(moduleData.title)}</langstring>
        </title>
        <description>
          <langstring xml:lang="${config.language}">${escapeXml(moduleData.description)}</langstring>
        </description>
${keywordElements}
      </general>
      <lifecycle>
        <version>
          <langstring xml:lang="${config.language}">${moduleData.version}</langstring>
        </version>
        <contribute>
          <role>
            <value>Author</value>
          </role>
          <entity>${escapeXml(moduleData.metadata.author)}</entity>
          <date>
            <datetime>${moduleData.metadata.createdAt}</datetime>
          </date>
        </contribute>
      </lifecycle>
      <technical>
        <format>text/html</format>
      </technical>
      <educational>
        <typicallearningtime>
          <datetime>${config.typicalDuration}</datetime>
        </typicallearningtime>
      </educational>
      <rights>
        <description>
          <langstring xml:lang="${config.language}">(c) ${new Date().getFullYear()} ${escapeXml(config.organization)}. Tous droits reserves.</langstring>
        </description>
      </rights>
    </lom>
  </metadata>

  <organizations default="${orgId}">
    <organization identifier="${orgId}">
      <title>${escapeXml(moduleData.title)}</title>
      <item identifier="${itemId}" identifierref="${resourceId}">
        <title>${escapeXml(moduleData.metadata.competenceCode)} - ${escapeXml(moduleData.metadata.competenceLabel)}</title>
        <adlcp:masteryscore>${config.masteryScore}</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>

  <resources>
    <resource identifier="${resourceId}" type="webcontent" adlcp:scormtype="sco" href="index.html">
${fileElements}
    </resource>
  </resources>
</manifest>`;
}

/**
 * Generate SCORM 2004 (3rd Edition) manifest
 */
export function generateScorm2004Manifest(
  moduleData: ScormModuleData,
  files: string[],
  config: ScormExportConfig
): string {
  const identifier = sanitizeIdentifier(
    `HARMONIA_${moduleData.metadata.competenceCode}_${Date.now()}`
  );

  const resourceId = `RES_${sanitizeIdentifier(moduleData.metadata.competenceCode)}`;
  const itemId = `ITEM_${sanitizeIdentifier(moduleData.metadata.competenceCode)}`;
  const orgId = 'HARMONIA_ORG';

  const fileElements = files
    .map(f => `      <file href="${escapeXml(f)}"/>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${identifier}" version="1.3"
    xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
    xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
    xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
    xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
    xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd
                        http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd
                        http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd
                        http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd
                        http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">

  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 3rd Edition</schemaversion>
  </metadata>

  <organizations default="${orgId}">
    <organization identifier="${orgId}">
      <title>${escapeXml(moduleData.title)}</title>
      <item identifier="${itemId}" identifierref="${resourceId}">
        <title>${escapeXml(moduleData.metadata.competenceCode)} - ${escapeXml(moduleData.metadata.competenceLabel)}</title>
        <imsss:sequencing>
          <imsss:deliveryControls completionSetByContent="true" objectiveSetByContent="true"/>
          <imsss:objectives>
            <imsss:primaryObjective objectiveID="PRIMARYOBJ" satisfiedByMeasure="true">
              <imsss:minNormalizedMeasure>${config.masteryScore / 100}</imsss:minNormalizedMeasure>
            </imsss:primaryObjective>
          </imsss:objectives>
        </imsss:sequencing>
      </item>
    </organization>
  </organizations>

  <resources>
    <resource identifier="${resourceId}" type="webcontent" adlcp:scormType="sco" href="index.html">
${fileElements}
    </resource>
  </resources>
</manifest>`;
}

/**
 * Generate manifest based on SCORM version
 */
export function generateManifest(
  moduleData: ScormModuleData,
  files: string[],
  config: ScormExportConfig
): string {
  if (config.version === '1.2') {
    return generateScorm12Manifest(moduleData, files, config);
  } else {
    return generateScorm2004Manifest(moduleData, files, config);
  }
}

// Helper functions

function sanitizeIdentifier(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 50);
}

function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
