import React from 'react';
import { render, act } from "@testing-library/react";
import { DocumentNode } from 'graphql';
import gql from 'graphql-tag';
import { mockSingleLink } from '../../../testing';
import { ApolloClient } from '../../../core';
import { InMemoryCache } from '../../../cache';
import { ApolloProvider } from '../../context';
import { useLazyQuery } from '../../hooks';
import { renderToStringWithData } from '../../ssr';

describe('useLazyQuery Hook SSR', () => {
  const CAR_QUERY: DocumentNode = gql`
    query {
      cars {
        make
        model
        vin
      }
    }
  `;

  const CAR_RESULT_DATA = {
    cars: [
      {
        make: 'Audi',
        model: 'RS8',
        vin: 'DOLLADOLLABILL',
        __typename: 'Car'
      }
    ]
  };

  it('should run query only after calling the lazy mode execute function', async () => {
    const link = mockSingleLink({
      request: { query: CAR_QUERY },
      result: { data: CAR_RESULT_DATA }
    });

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
      ssrMode: true
    });

    const Component = () => {
      let html = null;
      const [execute, { loading, called, data }] = useLazyQuery(CAR_QUERY);

      if (!loading && !called) {
        execute();
      }

      if (!loading && called) {
        expect(loading).toEqual(false);
        expect(data).toEqual(CAR_RESULT_DATA);
        html = <p>{data.cars[0].make}</p>;
      }

      return html;
    };

    const serverApp = (
      <ApolloProvider client={client}>
        <Component />
      </ApolloProvider>
    );

    const markup = await renderToStringWithData(serverApp)
    expect(markup).toMatch(/Audi/);

    const state = client.cache.extract()
    const clientCache = new InMemoryCache().restore(state)
    const clientApp = (
      <ApolloProvider client={new ApolloClient({cache: clientCache, link, ssrMode: true})}>
        <Component />
      </ApolloProvider>
    );

    // Create a container to hydrate
    const clientContainer = document.body.appendChild(
      document.createElement("div")
    );
    // Put the server-rendered markup into the container
    clientContainer.innerHTML = markup;

    const consoleErrorSpy = jest.spyOn(console, 'error')
    await act(async () => {
      await render(clientApp, {container: clientContainer, hydrate: true})
    })

    expect(consoleErrorSpy).not.toHaveBeenCalled()
  });
});
