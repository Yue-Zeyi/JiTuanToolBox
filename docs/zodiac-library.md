# Zodiac calendar dependency and calculation policy

## Pinned dependency

- Package: `lunar-javascript@1.7.7`.
- Upstream: https://github.com/6tail/lunar-javascript
- npm source: https://registry.npmjs.org/lunar-javascript/-/lunar-javascript-1.7.7.tgz
- Retrieved with `npm pack lunar-javascript@1.7.7` on 2026-09-08.
- Tarball SHA-1 reported by npm: `2c7a359f2ffc414ce2b0214f59148ff7a823851f`.
- Vendored file: `utils/vendor/lunar-javascript.js`, the unmodified package `lunar.js` renamed for clarity; 435942 bytes.
- Vendored SHA-256: `9750324bfe1aa63c146f8c72b1143df924466c11c8a5277d7d9225c541a18aaa`.
- License: MIT, Copyright (c) 2018 6tail; exact license in `utils/vendor/LICENSE-lunar-javascript`.

The dependency has no runtime network requests or package dependencies. Its CommonJS export works with the mini program's local `require`. The application only exposes cultural calendar information: calendar years, zodiac animals, stem elements and na yin. The upstream package also contains other traditional-calendar APIs, which this tool does not expose or call for predictions.

## Calendar and age policy

Inputs use Gregorian years 1900 through 2100 inclusive. A birthday at the beginning of 1900 can correctly return lunar/solar-term year 1899. Year-only and reverse lookup may include future years; those rows have null age bounds and null personal benmingnian status. Full birthdays cannot be in the future.

Every date and time is interpreted in fixed UTC+8, regardless of the device's timezone. This is a fixed convention, not historical local time or daylight saving time. Injected `now` accepts an epoch timestamp, a `Date`, or an ISO date-time with an explicit timezone. `getToday({now})` returns `YYYY-MM-DD` in UTC+8.

The CNY convention changes at 00:00:00 UTC+8 on the library's first day of lunar month one. The LiChun convention changes at the solar-term timestamp returned by the library, retaining seconds. These are library calculations displayed to the second; this precision is not an independent certification of astronomical accuracy. Boundary fixtures are pinned to this library version, not a claim of independent ephemeris validation. No local approximation or hand-written lunar calendar is substituted.

An omitted birth time represents the whole civil day. `HH:mm` represents that minute, and `HH:mm:ss` represents that second. An interval that spans LiChun produces `isAmbiguous: true`, `lichun: null`, and both `lichunOptions`. It never silently chooses midnight or noon as the answer. At the exact LiChun second the new year applies. CNY is unambiguous from a full civil date. The `differenceWindow` begins inclusively at the earlier annual boundary and ends exclusively at the later one. The ordering changes between years.

Age is completed Gregorian civil years in UTC+8; birth time does not delay the birthday. In a nonleap current year, a February 29 birthday is treated as February 28. Year-only results provide a range `[max(0, currentYear - year - 1), currentYear - year]`, labeled approximate; exact birthdays are required to determine personal results. The birth year's stem element and the full year-cycle na yin are separate fields. Library spelling is preserved, including the na yin name for the 2024/2025 cycle.

Birthday benmingnian compares the birth animal to the current animal using the same convention independently for CNY and LiChun. It does not compare to Gregorian-year modulo 12. Year-only benmingnian is a CNY-based overview with an explicit approximation note.

## Public interface

`utils/zodiac.js` exports `ANIMALS`, `getToday(options)`, `getYearResult(year, options)`, `getBirthdayResult(dateString, timeString, options)` and `findZodiacYears(animal, startYear, endYear, options)`. Options are optional and currently contain only `now`. Invalid inputs throw a Chinese-language `Error` suitable for a form message. Returned values are serializable plain objects and arrays.

Each year record has `year`, `yearLabel`, `animal`, `ganZhi`, `stemElement`, `naYin`, `cnyDate`, `liChunAt`, `isBenMingNian` and `benMingNianText`. Year-only records add `ageMin`, `ageMax`, `ageText`, `isApproximate` and `boundaryNote`.

Birthday results add `date`, `time`, `timePrecision`, `cny`, `lichun`, `lichunOptions`, `cnyDate`, `liChunAt`, `differenceWindow`, `isAmbiguous`, `hasDifference`, `age`, `ageText` and `boundaryNote`. `hasDifference` is null when ambiguous. The annual boundary strings at the top level belong to the queried Gregorian year. The boundary strings inside a year record belong to that assigned calendar year. `differenceWindow` contains `startAt`, `endAt` and `earlierConvention` (`cny` or `lichun`). Timestamp strings are `YYYY-MM-DD HH:mm:ss` in UTC+8.

Reverse lookup returns inclusive matches in ascending order, or an empty array. Rows use the year-only shape. No calendar library objects leak through the interface.

## Verification

Run `node --test tests/zodiac.test.js`. Coverage includes the two possible CNY/LiChun orderings (2024 and 2025), midnight and second-level boundaries, unknown/minute birth times, 1900/2100 bounds, lunar year 1899, leap-day ages, current convention changes, future input rejection, reverse lookup ordering, and separate processes in UTC, America/Los_Angeles and Asia/Shanghai.

The source fixtures include CNY 2024-02-10 and LiChun 2024-02-04 16:27:07, plus CNY 2025-01-29 and LiChun 2025-02-03 22:10:28. Future upgrades should be deliberate and re-run these checks; changes to solar-term timestamps require review.
