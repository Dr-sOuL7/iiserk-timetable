/**
 * GENERATED FILE - do not edit by hand.
 * Source: tools/raw/midsem_venues_1.csv (venues) + tools/raw/midsem_venues_2.csv (dates/shifts)
 * Regenerate with: node tools/build-midsem.js
 *
 * The Mid-Sem schedule, one entry per course. Course name is intentionally
 * NOT included - it is looked up from data/timetable.js's course catalog at
 * render time, the same way timetable events already work.
 */
(function (global) {
  'use strict';

  var MIDSEM = {
    /** 10:00-11:30 and 15:00-16:30, exactly as published. Informational only
     * (each exam already carries its own resolved time/duration); kept here
     * so the shift definition has one home if it's ever needed again. */
    shifts: {
          "1": {
                "time": "10:00",
                "duration": 90
          },
          "2": {
                "time": "15:00",
                "duration": 90
          }
    },
    /**
     * Every Mid-Sem exam, one per course.
     *   id       - stable, content-derived ("midsem-<course>")
     *   course   - course code exactly as published
     *   date     - "YYYY-MM-DD"
     *   time     - 24h start time, "HH:MM"
     *   minutes  - start time as minutes since midnight (sortable)
     *   duration - length in minutes (90 for both shifts)
     *   shift    - 1 or 2, informational
     *   venue    - the room, or every allocated room with its roll-number
     *              range when there is more than one (roll-number-split
     *              sections), e.g. "G02 (24MS001 to 24MS158); G08 (...)"
     */
    exams: [
      {"id":"midsem-ch4104","course":"CH4104","date":"2026-09-05","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"110 (23MS006 to 23MS273, Reenrollment); 108 (25MP, 26RS)"},
      {"id":"midsem-ch4127","course":"CH4127","date":"2026-09-05","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"101"},
      {"id":"midsem-es3103","course":"ES3103","date":"2026-09-05","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"111"},
      {"id":"midsem-ls2103","course":"LS2103","date":"2026-09-05","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"G05 (25MS001 to 25MS113, Reenrollment); G02 (25MS114 to 25MS213); G08 (25MS214 to 25MS328)"},
      {"id":"midsem-ls3102","course":"LS3102","date":"2026-09-05","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"G06"},
      {"id":"midsem-ma3104","course":"MA3104","date":"2026-09-05","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"201 (24MS003 to 24MS152, Reenrollment); 209 (24MS156 to 24MS233, 25MP, 26MP, RS)"},
      {"id":"midsem-ma4112","course":"MA4112","date":"2026-09-05","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"G09"},
      {"id":"midsem-ph4102","course":"PH4102","date":"2026-09-05","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"102 (23MS004 to 23MS132, Reenrollment); 103 (23MS133 to 23MS270, IP, VS)"},
      {"id":"midsem-ph5113","course":"PH5113","date":"2026-09-05","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"G09"},
      {"id":"midsem-ch4111","course":"CH4111","date":"2026-09-05","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"G06"},
      {"id":"midsem-ch4125","course":"CH4125","date":"2026-09-05","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"110"},
      {"id":"midsem-ch5103","course":"CH5103","date":"2026-09-05","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"101"},
      {"id":"midsem-es4107","course":"ES4107","date":"2026-09-05","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"110"},
      {"id":"midsem-ls4107","course":"LS4107","date":"2026-09-05","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"102 (23MS001 to 23MS203, Reenrollment); 103 (23MS204 to 23MS274, IP, MP, RS, VS)"},
      {"id":"midsem-ls4112","course":"LS4112","date":"2026-09-05","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"110"},
      {"id":"midsem-ma2102","course":"MA2102","date":"2026-09-05","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"G02 (25MS001 to 25MS132); G08 (25M8134 to 25MS323)"},
      {"id":"midsem-ma4104","course":"MA4104","date":"2026-09-05","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"G09"},
      {"id":"midsem-ph3103","course":"PH3103","date":"2026-09-05","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"G05 (24M5001 to 24MS192, Recnrollment); G06 (24MS194 to 24MS247, IP)"},
      {"id":"midsem-ph4108","course":"PH4108","date":"2026-09-05","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"G06"},
      {"id":"midsem-ch2102","course":"CH2102","date":"2026-09-07","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"G05 (25MS002 to 25MS110, Reenrollment); G02 (25MS111 to 25MS229); G08 (25MS230 to 25MS328)"},
      {"id":"midsem-ch3104","course":"CH3104","date":"2026-09-07","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"110"},
      {"id":"midsem-ch4105","course":"CH4105","date":"2026-09-07","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"108"},
      {"id":"midsem-ch4109","course":"CH4109","date":"2026-09-07","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"112"},
      {"id":"midsem-ch4122","course":"CH4122","date":"2026-09-07","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"102"},
      {"id":"midsem-ls4102","course":"LS4102","date":"2026-09-07","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"103"},
      {"id":"midsem-ls4113","course":"LS4113","date":"2026-09-07","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"108"},
      {"id":"midsem-ma3108","course":"MA3108","date":"2026-09-07","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"102"},
      {"id":"midsem-ph4113","course":"PH4113","date":"2026-09-07","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"G06"},
      {"id":"midsem-ch4106","course":"CH4106","date":"2026-09-07","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"112"},
      {"id":"midsem-es2103","course":"ES2103","date":"2026-09-07","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"G02 (25MS004 to 25MS160); G08 (25MS161 to 25MS328)"},
      {"id":"midsem-ls3101","course":"LS3101","date":"2026-09-07","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"110"},
      {"id":"midsem-ls4106","course":"LS4106","date":"2026-09-07","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"201"},
      {"id":"midsem-ls5101","course":"LS5101","date":"2026-09-07","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"102"},
      {"id":"midsem-ma3109","course":"MA3109","date":"2026-09-07","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"102"},
      {"id":"midsem-ma5102","course":"MA5102","date":"2026-09-07","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"108"},
      {"id":"midsem-ph3102","course":"PH3102","date":"2026-09-07","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"G06"},
      {"id":"midsem-ph4106","course":"PH4106","date":"2026-09-07","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"103"},
      {"id":"midsem-cs2101","course":"CS2101","date":"2026-09-08","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"G02"},
      {"id":"midsem-ch3103","course":"CH3103","date":"2026-09-08","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"G06"},
      {"id":"midsem-es3108","course":"ES3108","date":"2026-09-08","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"102"},
      {"id":"midsem-ls4109","course":"LS4109","date":"2026-09-08","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"103"},
      {"id":"midsem-ma4110","course":"MA4110","date":"2026-09-08","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"101"},
      {"id":"midsem-ph2104","course":"PH2104","date":"2026-09-08","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"G05 (25M5001 to 25MS111, Reenrollment); G02 (25MS112 to 25MS236); G08 (25MS237 to 25MS327)"},
      {"id":"midsem-ph4104","course":"PH4104","date":"2026-09-08","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"110"},
      {"id":"midsem-ph5103","course":"PH5103","date":"2026-09-08","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"G06"},
      {"id":"midsem-ch4121","course":"CH4121","date":"2026-09-09","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"110 (23M5006 to 23MS266, Reenrollment); 111 (23MS268 to 23MS273, MP, RS, VS)"},
      {"id":"midsem-ch4126","course":"CH4126","date":"2026-09-09","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"112"},
      {"id":"midsem-es3101","course":"ES3101","date":"2026-09-09","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"101"},
      {"id":"midsem-es4108","course":"ES4108","date":"2026-09-09","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"G09"},
      {"id":"midsem-ls2101","course":"LS2101","date":"2026-09-09","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"G05 (25M5001 to 25M5110, Reenrollment); G02 (25MS112 to 25MS213); G08 (25MS214 to 25MS328)"},
      {"id":"midsem-ls4101","course":"LS4101","date":"2026-09-09","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"209"},
      {"id":"midsem-ma4101","course":"MA4101","date":"2026-09-09","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"108"},
      {"id":"midsem-ma4102","course":"MA4102","date":"2026-09-09","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"103"},
      {"id":"midsem-ph3101","course":"PH3101","date":"2026-09-09","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"G06"},
      {"id":"midsem-ph4107","course":"PH4107","date":"2026-09-09","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"102"},
      {"id":"midsem-ch2105","course":"CH2105","date":"2026-09-09","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"G05 (25MS002 to 25MS110, Reenrollment); G02 (25MS111 to 25MS229); G08 (25MS230 to 25MS328)"},
      {"id":"midsem-ch4114","course":"CH4114","date":"2026-09-10","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"102"},
      {"id":"midsem-ch4117","course":"CH4117","date":"2026-09-10","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"110"},
      {"id":"midsem-ch5104","course":"CH5104","date":"2026-09-10","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"G09"},
      {"id":"midsem-es3105","course":"ES3105","date":"2026-09-10","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"G08"},
      {"id":"midsem-es4103","course":"ES4103","date":"2026-09-10","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"G05"},
      {"id":"midsem-ls3103","course":"LS3103","date":"2026-09-10","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"G06"},
      {"id":"midsem-ls4115","course":"LS4115","date":"2026-09-10","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"110"},
      {"id":"midsem-ma2104","course":"MA2104","date":"2026-09-10","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"G02 (25MS001 to 25MS199, RS); G08 (25MS201 to 25MS323)"},
      {"id":"midsem-ma3110","course":"MA3110","date":"2026-09-10","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"G05"},
      {"id":"midsem-ma4107","course":"MA4107","date":"2026-09-10","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"110"},
      {"id":"midsem-ma5126","course":"MA5126","date":"2026-09-10","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"G09"},
      {"id":"midsem-ch3102","course":"CH3102","date":"2026-09-10","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"110"},
      {"id":"midsem-ch4107","course":"CH4107","date":"2026-09-10","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"G05"},
      {"id":"midsem-ch4128","course":"CH4128","date":"2026-09-10","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"112"},
      {"id":"midsem-es2104","course":"ES2104","date":"2026-09-10","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"G02 (25MS004 to 25MS185, Reenrollment); G08 (25MS189 to 25MS328)"},
      {"id":"midsem-es4105","course":"ES4105","date":"2026-09-10","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"G08"},
      {"id":"midsem-ma4106","course":"MA4106","date":"2026-09-10","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"112"},
      {"id":"midsem-ph3104","course":"PH3104","date":"2026-09-10","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"G06"},
      {"id":"midsem-ph4101","course":"PH4101","date":"2026-09-10","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"102 (23MS004 to 23MS132, Reenrollment); 103 (23M5133 to 23MS265, IP, RS)"},
      {"id":"midsem-ph2101","course":"PH2101","date":"2026-09-11","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"G05 (25MS001 to 25MS094, Reenrollment); G02 (25MS096 to 25MS218); G08 (25MS221 to 25MS327)"},
      {"id":"midsem-ch3101","course":"CH3101","date":"2026-09-11","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"G06"},
      {"id":"midsem-ch4102","course":"CH4102","date":"2026-09-11","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"110 (23MS006 to 23MS273, Reenrollment); 111 (26MP, 26RS)"},
      {"id":"midsem-ch5102","course":"CH5102","date":"2026-09-11","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"209"},
      {"id":"midsem-es4101","course":"ES4101","date":"2026-09-11","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"108"},
      {"id":"midsem-ls4103","course":"LS4103","date":"2026-09-11","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"102"},
      {"id":"midsem-ma2101","course":"MA2101","date":"2026-09-11","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"G05"},
      {"id":"midsem-ma3101","course":"MA3101","date":"2026-09-11","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"112"},
      {"id":"midsem-ph4110","course":"PH4110","date":"2026-09-11","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"103"},
      {"id":"midsem-cs2102","course":"CS2102","date":"2026-09-12","time":"10:00","minutes":600,"duration":90,"shift":1,"venue":"G02 (24MS001 to 24MS158, 22MS213, 23M5013 to 23MS256); G08 (24MS167 to 24MS249, 25MS020 to 25MS225)"},
      {"id":"midsem-ch2104","course":"CH2104","date":"2026-09-12","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"G05 (25MS002 to 25MS110, Reenrollment); G02 (25MS111 to 25MS229); G08 (25MS230 to 25MS328)"},
      {"id":"midsem-ch3106","course":"CH3106","date":"2026-09-12","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"108"},
      {"id":"midsem-ch4115","course":"CH4115","date":"2026-09-12","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"101"},
      {"id":"midsem-ch4116","course":"CH4116","date":"2026-09-12","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"111"},
      {"id":"midsem-cs4103","course":"CS4103","date":"2026-09-12","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"102 (23MS002 to 23MS111, 22RS, Reenrollment); 103 (23MS120 to 23MS273, IP, 25RS, 26RS)"},
      {"id":"midsem-ls4105","course":"LS4105","date":"2026-09-12","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"G06"},
      {"id":"midsem-ma3103","course":"MA3103","date":"2026-09-12","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"112"},
      {"id":"midsem-ma5122","course":"MA5122","date":"2026-09-12","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"G06"},
      {"id":"midsem-ph5114","course":"PH5114","date":"2026-09-12","time":"15:00","minutes":900,"duration":90,"shift":2,"venue":"G06"}
    ]
  };

  global.MIDSEM_DATA = MIDSEM;
})(typeof globalThis !== 'undefined' ? globalThis : self);
