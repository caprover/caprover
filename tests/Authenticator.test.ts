import bcrypt = require('bcryptjs')

test('Testing Authenticator 1', () => {
    const passwordStored =
        '5EXJbB3Ys4fSg8M7m8FFt8duVvej9oD93SfgXjNNn6EbXG9KU63CZhZbRZ79amRw'
    // const passwordEntered =
    //     '5EXJbB3Ys4fSg8M7m8FFt8duVvej9oD93SfgXjNNnaaaaaaaaaaaaaaaaaaaaaaaaaa6EbXG9KU63CZhZbRZ79amRw'
    const HASH = '2848d8c9-4719-4ad1-bc12-c405a78913c5captain'

    let hashed = bcrypt.hashSync(HASH + passwordStored, bcrypt.genSaltSync(10))

    hashed = '$2a$10$9pEXSGfCSiz/ZC49ucqHuOCiuCy2dK17uqQtXn8BQfx2jt8cYFA9K'

    expect(
        bcrypt.compareSync(
            HASH +
                '5EXJbB3Ys4fSg8M7m8FFt8duVvej9oD93SfgXjNNnaaaaaaaaaaaaaaaaaaaaaaaaaa6EbXG9KU63CZhZbRZ79amRw',
            hashed
        )
    ).toBe(true)
})
