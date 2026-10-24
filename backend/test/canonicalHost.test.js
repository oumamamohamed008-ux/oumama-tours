const assert = require("node:assert/strict");
const test = require("node:test");
const redirectCanonicalHost = require("../middleware/canonicalHost");

test("redirects www requests to the canonical host preserving path and query", () => {
    let redirect;
    let nextCalled = false;

    redirectCanonicalHost(
        {
            hostname: "www.oumamatours.site",
            originalUrl: "/booking.html?source=search"
        },
        {
            redirect(status, url) {
                redirect = { status, url };
            }
        },
        () => {
            nextCalled = true;
        }
    );

    assert.deepEqual(redirect, {
        status: 308,
        url: "https://oumamatours.site/booking.html?source=search"
    });
    assert.equal(nextCalled, false);
});

test("does not redirect requests already using the canonical host", () => {
    let nextCalled = false;

    redirectCanonicalHost(
        {
            hostname: "oumamatours.site",
            originalUrl: "/"
        },
        {
            redirect() {
                assert.fail("canonical host should not redirect");
            }
        },
        () => {
            nextCalled = true;
        }
    );

    assert.equal(nextCalled, true);
});
