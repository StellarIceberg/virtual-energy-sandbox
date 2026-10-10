const root = 'https://help.amber.com.au/hc/en-us/articles/';
export const sources = {
  communication: {title:'Troubleshooting SmartShift communication issues', url:root+'26313725905037-Troubleshooting-SmartShift-Communication-Issues'},
  curtailment: {title:'What to do when solar curtailment is not working', url:root+'35294215672845-What-to-do-when-solar-curtailment-isn-t-working'},
  reserve: {title:'How much battery energy can Amber access?', url:root+'26733365644045-How-much-of-my-battery-energy-can-Amber-access'},
  troubleshooting: {title:'Device troubleshooting: where to begin', url:root+'38919749770125-Device-troubleshooting-Where-to-Begin-and-is-SmartShift-Causing-the-Issue'},
  coupling: {title:'AC coupling vs DC coupling', url:root+'40457118061453-AC-coupling-vs-DC-coupling-What-it-means-for-SmartShift'},
  loadFollowing: {title:'Load-following curtailment', url:root+'20248505808781-Load-following-curtailment-who-it-applies-to-and-how-it-works'},
  fox: {title:'Enrolling a Fox ESS system', url:root+'38980157821197-Enrolling-your-Fox-ESS-system-with-Amber'},
  status: {title:'Public SmartShift status and historical issues', url:root+'35922375367181-SmartShift-Status'},
};
export type SourceId = keyof typeof sources;
export const labScenarios = {
  communication: {
    name:'Inverter communication loss', symptom:'Remote commands and device telemetry are unavailable.',
    support:'The public communication guide describes loss of the automation connection, separately from local system operation.',
    assumption:'Local self-consumption continues and remote curtailment stops. Actual fallback modes vary by manufacturer.',
    checks:['Check Wi-Fi and the manufacturer app connection status.','Compare local operation with remote control availability.'],
    sources:['communication','status'] as SourceId[], category:'Communication unavailable', solar:true,
  },
  curtailment: {
    name:'Solar curtailment not executed', symptom:'Solar exports continue during a negative feed-in tariff.',
    support:'The public curtailment guide discusses firmware and device conditions that prevent curtailment instructions working.',
    assumption:'A command is requested but rejected immediately. Storage starts full so exported surplus is visible.',
    checks:['Compare the requested action with actual output.','Review public firmware and compatibility guidance.'],
    sources:['curtailment'] as SourceId[], category:'Command not executed', solar:true,
  },
  battery: {
    name:'Battery fails to discharge', symptom:'Available storage does not produce the expected battery export.',
    support:'Public guidance separates reserve restrictions, device locks and automation behaviour.',
    assumption:'Choose one cause below. A reserve restriction is expected behaviour; a rejected command is a simulated failure.',
    checks:['Compare SoC with the manufacturer reserve and automated export floor.','Check whether the manufacturer app shows a device lock.'],
    sources:['reserve','troubleshooting'] as SourceId[], category:'Inspect the cause', solar:false,
  },
  exportLimit: {
    name:'Export limit restriction', symptom:'A favourable tariff does not lead to battery exports.',
    support:'Public troubleshooting guidance identifies import/export limits as device settings. Historical status reports describe export restrictions.',
    assumption:'A local hard site limit of 0 kW blocks exports but still allows household supply. Only a simulation setting is changed here.',
    checks:['Check the approved site limit with the installer or distributor.','Compare the permitted limit with the device setting; do not bypass a required limit.'],
    sources:['troubleshooting','status'] as SourceId[], category:'Physical export restriction', solar:false,
  },
  secondary: {
    name:'Secondary solar inverter not controllable', symptom:'One solar inverter curtails while another continues producing.',
    support:'Public coupling and curtailment guides explain that an additional unsupported or unenrolled inverter may remain uncontrolled.',
    assumption:'This alternate lab topology splits the 10 kW array between the hybrid inverter and an additional 5 kW solar-only inverter; it adds no battery inverter. The secondary branch has no remote curtailment; storage starts full.',
    checks:['Identify all solar inverters and their enrolment.','Check each inverter’s public compatibility requirements.'],
    sources:['coupling','curtailment'] as SourceId[], category:'Partial solar control', solar:true,
  },
  reserve: {
    name:'Battery reserve conflict', symptom:'Energy is stored, but discharge is limited by a higher manufacturer reserve.',
    support:'The manufacturer reserve takes priority. The automated export floor is a separate restriction.',
    assumption:'The battery starts at 45% while its manufacturer reserve is 60%. The controller respects that setting; no hardware fault is implied.',
    checks:['Compare the manufacturer reserve with the reserve known to automation.','Remember stored energy and exportable energy are different quantities.'],
    sources:['reserve'] as SourceId[], category:'Expected reserve behaviour', solar:false,
  },
  ev: {
    name:'Curtailment and EV charging load', symptom:'Adding household EV demand changes the solar output required.',
    support:'Load-following curtailment reduces solar production while supplying household demand on supported systems.',
    assumption:'EV charging is a controllable 0–7 kW household load. It does not disable curtailment; no brand-specific EV exception is modelled.',
    checks:['Compare household demand with solar production.','Check support for load-following curtailment on the actual system.'],
    sources:['loadFollowing'] as SourceId[], category:'Expected load-following behaviour', solar:true,
  },
  firmware: {
    name:'Firmware or integration compatibility', symptom:'Local energy operation continues, but remote commands are rejected.',
    support:'The public Fox ESS enrolment guide requires compatible firmware; public status reports describe control and data issues.',
    assumption:'A generic compatibility warning rejects remote curtailment. This does not diagnose any brand, firmware version or current outage.',
    checks:['Check public firmware requirements for the actual device.','Review public status information and manufacturer update instructions.'],
    sources:['fox','status'] as SourceId[], category:'Simulated compatibility warning', solar:true,
  },
};
export type LabId = keyof typeof labScenarios;
