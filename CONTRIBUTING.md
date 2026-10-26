# Contributing to bchd-explorer

## Bug Reports

* Ensure your issue [has not already been reported][1]. It may already be fixed!
* Include the steps you carried out to produce the problem.
* Include the behavior you observed along with the behavior you expected, and
  why you expected it.
* Include any relevant stack traces or debugging output.

## Feature Requests

We welcome feedback with or without pull requests. If you have an idea for how
to improve the project, great! All we ask is that you take the time to write a
clear and concise explanation of what need you are trying to solve. If you have
thoughts on _how_ it can be solved, include those too!

The best way to see a feature added, however, is to submit a pull request.

## Pull Requests

* Before creating your pull request, it's usually worth asking if the code
  you're planning on writing will actually be considered for merging. You can
  do this by [opening an issue][1] and asking. It may also help give the
  maintainers context for when the time comes to review your code.

* Ensure your [commit messages are well-written][2]. This can double as your
  pull request message, so it pays to take the time to write a clear message.

* Add tests for your feature. You should be able to look at other tests for
  examples. If you're unsure, don't hesitate to [open an issue][1] and ask!

* Submit your pull request!

## Support Requests

This explorer only displays data from a bchd node. Problems with the node itself
(sync, indexes, gRPC errors) belong in the [bchd issue tracker][3]. Problems with
the explorer belong in [this repository's issues][1].

[1]: https://github.com/zquestz/bchd-explorer/issues
[2]: https://medium.com/brigade-engineering/the-secrets-to-great-commit-messages-106fc0a92a25
[3]: https://github.com/gcash/bchd/issues
