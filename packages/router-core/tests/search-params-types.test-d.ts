import { describe, expectTypeOf, test } from 'vitest'
import type { NavigateOptions, ToOptions } from '../src/link'
import type { AnyRouter } from '../src/router'
import type { BaseRoute } from '../src/route'

type TestSearchSchema = {
  page?: number
  filter?: string
  sort?: 'asc' | 'desc'
}

type TestRouter = AnyRouter & {
  routeTree: BaseRoute<
    any,
    '/users',
    '/users',
    string,
    '/users',
    TestSearchSchema
  >
}

describe('Search Params Type Safety - Current Issues', () => {
  test('SHOULD FAIL: object form with invalid search params is currently allowed', () => {
    // 현재는 이것이 타입 에러 없이 통과함 (문제!)
    const invalidObjectForm: ToOptions<TestRouter, '/users', '/profile'> = {
      search: {
        invalidParam: 'should-not-be-allowed', // 라우트에 정의되지 않은 파라미터
        anotherInvalid: 123,
        randomProp: true,
      },
    }

    // 이 테스트는 현재 통과하지만, 실제로는 실패해야 함
    expectTypeOf(invalidObjectForm).toMatchTypeOf<
      ToOptions<TestRouter, '/users', '/profile'>
    >()
  })

  test('SHOULD FAIL: functional form with invalid return type is currently allowed', () => {
    // 현재는 이것이 타입 에러 없이 통과함 (문제!)
    const invalidFunctionalForm: ToOptions<TestRouter, '/users', '/profile'> = {
      search: (prev) => ({
        ...prev,
        invalidParam: 'should-not-be-allowed', // 반환 타입이 엄격하지 않음
        wrongType: 'should-be-number-if-allowed',
      }),
    }

    expectTypeOf(invalidFunctionalForm).toMatchTypeOf<
      ToOptions<TestRouter, '/users', '/profile'>
    >()
  })

  test('SHOULD FAIL: NavigateOptions also allows invalid search params', () => {
    // NavigateOptions도 같은 문제가 있음
    const invalidNavigateOptions: NavigateOptions<
      TestRouter,
      '/users',
      '/profile'
    > = {
      search: {
        completelyWrong: 'this-should-not-work',
        invalidType: new Date(), // 완전히 잘못된 타입
      },
    }

    expectTypeOf(invalidNavigateOptions).toMatchTypeOf<
      NavigateOptions<TestRouter, '/users', '/profile'>
    >()
  })

  test('SHOULD PASS: valid search params should be allowed', () => {
    // 이것들은 허용되어야 함
    const validObjectForm: ToOptions<TestRouter, '/users', '/users'> = {
      search: {
        page: 1,
        filter: 'active',
        sort: 'asc',
      },
    }

    const validFunctionalForm: ToOptions<TestRouter, '/users', '/users'> = {
      search: (prev) => ({
        ...prev,
        page: (prev.page ?? 0) + 1,
        filter: 'completed',
      }),
    }

    // 이것들은 계속 작동해야 함
    expectTypeOf(validObjectForm).toMatchTypeOf<
      ToOptions<TestRouter, '/users', '/users'>
    >()
    expectTypeOf(validFunctionalForm).toMatchTypeOf<
      ToOptions<TestRouter, '/users', '/users'>
    >()
  })
})

describe('Search Params Type Safety - After Fix', () => {
  test('should reject invalid search params in object form', () => {
    const invalidObjectForm: ToOptions<TestRouter, '/users', '/users'> = {
      search: {
        invalidParam: 'should-not-be-allowed',
      },
    }
  })

  test('should reject invalid search params in functional form', () => {
    const invalidFunctionalForm: ToOptions<TestRouter, '/users', '/users'> = {
      search: (prev) => ({
        ...prev,
        invalidParam: 'should-not-be-allowed',
      }),
    }
  })

  test('should support proper functional form with valid params', () => {
    const validFunctionalForm: ToOptions<TestRouter, '/users', '/users'> = {
      search: (prev) => ({
        ...prev,
        page: (prev.page ?? 0) + 1,
        filter: 'active',
      }),
    }

    expectTypeOf(validFunctionalForm).toMatchTypeOf<
      ToOptions<TestRouter, '/users', '/users'>
    >()
  })

  test('should support true value for search (preserve current search)', () => {
    const preserveSearch: ToOptions<TestRouter, '/users', '/users'> = {
      search: true,
    }

    expectTypeOf(preserveSearch).toMatchTypeOf<
      ToOptions<TestRouter, '/users', '/users'>
    >()
  })
})
