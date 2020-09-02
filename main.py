import networkx as nx
from networkx.readwrite import json_graph
from flask import Flask
from flask_cors import CORS
from flask_caching import Cache
import requests
import urllib
import re
import time
import functools

WHITELIST = ["https://ego.jveres.me"]
PATTERN = ' vs '
LIMIT = 5
MAXDEPTH = 4
RADIUS = 25
K = None

graph = {'nodes': [], 'edges': []}

def resetGraph(query):
  graph['nodes'].clear()
  graph['edges'].clear()

def googleSearch(query):
  url = f"http://suggestqueries.google.com/complete/search?&output=chrome&gl=us&hl=en&q={urllib.parse.quote(query)}"
  return requests.request("GET", url).json()[1]

def addNode(node, depth = 0):
  for i, n in enumerate(graph['nodes']):
    if (n[0] == node):
      n[1]['count'] += 1
      if n[1]['depth'] > depth:
        n[1]['depth'] = depth
      return i
  graph['nodes'].append((node, {'count': 1, 'depth': depth}))

def getEdge(src, dest):
  for edge in graph['edges']:
    if ((edge[0] == src and edge[1] == dest)):
      return edge

def orderedDeDupe(list): 
   ret = []
   [ret.append(i) for i in list if not ret.count(i)]
   return ret

def filterResults(results, query):
  result = [result for result in results if result.startswith(query + PATTERN)]
  ret = []
  for result in results:
    splitted = result.split(PATTERN)
    for idx, text in enumerate(splitted):
      if (idx > 0 and text != query and not bool(re.match('^[0-9.]+$', text)) and not text.endswith('2020') and not text.endswith('2021')):
        ret.append(text)
  return orderedDeDupe(sorted(ret, key = lambda item: ret.count(item), reverse=True))[:LIMIT]

MAXWEIGHT = 2*LIMIT+1

def buildGraph(query, depth = 1):
  if (depth <= MAXDEPTH):
    results = filterResults(googleSearch(query + PATTERN), query)
    for hit in results:
      addNode(hit, depth)
    #print(depth, query, "->", results)
    for hitIdx, hit in enumerate(results):
      weight = LIMIT - hitIdx
      graph['edges'].append((query, hit, {'weight': weight, 'distance': MAXWEIGHT - weight, 'query': query + PATTERN + hit}))
      edge = getEdge(hit, query)
      if edge is not None:
        edge[2]['weight'] += weight
        edge[2]['distance'] -= weight
      buildGraph(hit, depth + 1)

def findSubGraphs(query, radius = RADIUS, k = K):
  G = nx.Graph()
  G.add_nodes_from(graph['nodes'])
  G.add_edges_from(graph['edges'])
  EG = nx.ego_graph(G, query, distance = 'distance', radius = radius)
  if k is None:
    return json_graph.node_link_data(EG)
  else:
    subgraphs = nx.algorithms.connectivity.edge_kcomponents.k_edge_subgraphs(EG, k = k)
    for s in subgraphs:
      if query in s:
        break
    pruned_EG = EG.subgraph(s)
    return json_graph.node_link_data(pruned_EG)

def timeit(func):
  @functools.wraps(func)
  def measure_time(*args, **kwargs):
    start_time = time.time()
    result = func(*args, **kwargs)
    end_time = time.time()
    print("@time: {}() took {} seconds.".format(func.__name__, end_time - start_time))
    return result
  return measure_time

app = Flask(__name__)
CORS(app, resources={r"/s/*": {"origins": "*"}})
app.config.from_mapping({"DEBUG": True, "CACHE_TYPE": "simple", "CACHE_DEFAULT_TIMEOUT": 3600})
cache = Cache(app)

@app.before_request
def check_url():
  from flask import request, abort
  if request.origin not in WHITELIST:
    abort(401)

@app.route("/s/", defaults={"query": ""}, methods=["GET"])
@app.route("/s/<path:query>", methods=["GET"])
@cache.cached(timeout=3600)
@timeit
def result(query):
  resetGraph(query)
  addNode(query, 0)
  buildGraph(query)
  val = findSubGraphs(query)
  return val

app.run(host="0.0.0.0")