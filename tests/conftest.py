"""Must load before local_api so SVI_TEST_MODE is set when Settings initializes."""

import os

os.environ.setdefault("SVI_TEST_MODE", "1")
